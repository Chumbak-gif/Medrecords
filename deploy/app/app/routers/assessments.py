"""
Assessments router
Prefix:  /api/v1/assessments  (mounted in main.py)

Access control:
  GET  /                — doctor, admin, sys_admin (doctor-scoped)
  POST /                — doctor only
  GET  /dashboard/kpis  — doctor, admin, sys_admin (doctor-scoped)
  GET  /{id}            — doctor, admin, sys_admin (doctor-scoped)
  PUT  /{id}            — doctor only
  POST /{id}/submit     — doctor only

State machine:
  draft  →  submitted  (POST /{id}/submit, requires consent_given=True)
  submitted  →  locked  (APScheduler, when lock_expires_at <= now())
"""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.app_config import AppConfig
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog
from app.models.form_template import FormTemplate
from app.models.user import User
from app.schemas.assessment import (
    AssessmentDetail,
    AssessmentPatientResponse,
    AssessmentResponse,
    CreateAssessmentDto,
    DoctorKpis,
    UpdateAssessmentDto,
)
from app.schemas.disease import PaginatedResponse

router = APIRouter(tags=["Assessments"])

# ---------------------------------------------------------------------------
# Role constants
# ---------------------------------------------------------------------------

_READ_ROLES = ["doctor", "admin", "sys_admin"]
_WRITE_ROLES = ["doctor"]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor: User,
    entity_type: str,
    entity_id: int,
    description: str,
) -> None:
    """Append an audit log entry (no commit — caller owns the transaction)."""
    db.add(
        AuditLog(
            event_type=event_type,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_role=actor.role,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
        )
    )


async def _get_lock_window_hours(db: AsyncSession) -> int:
    """Read lock_window_hours from app_config; default to 24 if not found."""
    result = await db.execute(
        select(AppConfig).where(AppConfig.config_key == "lock_window_hours")
    )
    config = result.scalar_one_or_none()
    if config is None:
        return 24
    try:
        return int(config.config_value)
    except (ValueError, TypeError):
        return 24


def _is_admin(user: User) -> bool:
    return user.role in ["admin", "sys_admin"]


async def _get_assessment_or_404(
    assessment_id: int,
    current_user: User,
    db: AsyncSession,
    *,
    load_prescription_rows: bool = False,
    load_patient: bool = False,
) -> Assessment:
    """Fetch assessment by id, enforce doctor-scoping, raise 404/403 as needed."""
    q = select(Assessment).where(Assessment.id == assessment_id)
    if load_prescription_rows:
        q = q.options(selectinload(Assessment.prescription_rows))
    if load_patient:
        q = q.options(selectinload(Assessment.patient))

    result = await db.execute(q)
    assessment: Optional[Assessment] = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Doctor-scoped: doctors can only see their own assessments
    if current_user.role == "doctor" and assessment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this assessment",
        )

    return assessment


# ---------------------------------------------------------------------------
# GET /dashboard/kpis — MUST be registered before /{id}
# ---------------------------------------------------------------------------

@router.get(
    "/dashboard/kpis",
    response_model=DoctorKpis,
    summary="Doctor KPI aggregates for the dashboard",
)
async def get_dashboard_kpis(
    current_user: User = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> DoctorKpis:
    # Base filter — doctor-scoped
    base_where = []
    if current_user.role == "doctor":
        base_where.append(Assessment.doctor_id == current_user.id)

    # total_patients: count of distinct patient_ids
    total_patients_q = select(func.count(Assessment.patient_id.distinct()))
    if base_where:
        total_patients_q = total_patients_q.where(*base_where)
    total_patients: int = (await db.execute(total_patients_q)).scalar_one()

    # this_month_submitted: submitted + locked in current calendar month
    now = datetime.now(tz=timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    this_month_q = (
        select(func.count())
        .select_from(Assessment)
        .where(
            Assessment.status.in_(["submitted", "locked"]),
            Assessment.submitted_at >= month_start,
        )
    )
    if base_where:
        this_month_q = this_month_q.where(*base_where)
    this_month_submitted: int = (await db.execute(this_month_q)).scalar_one()

    # drafts count
    drafts_q = (
        select(func.count())
        .select_from(Assessment)
        .where(Assessment.status == "draft")
    )
    if base_where:
        drafts_q = drafts_q.where(*base_where)
    drafts: int = (await db.execute(drafts_q)).scalar_one()

    # locked count
    locked_q = (
        select(func.count())
        .select_from(Assessment)
        .where(Assessment.status == "locked")
    )
    if base_where:
        locked_q = locked_q.where(*base_where)
    locked: int = (await db.execute(locked_q)).scalar_one()

    # today_visits: submitted + locked assessments created today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_q = (
        select(func.count())
        .select_from(Assessment)
        .where(
            Assessment.status.in_(["submitted", "locked"]),
            Assessment.submitted_at >= today_start,
        )
    )
    if base_where:
        today_q = today_q.where(*base_where)
    today_visits: int = (await db.execute(today_q)).scalar_one()

    # pending_followups: drafts that have a follow_up_date in the future
    # We store follow-up date in form_data as a JSON field; count all drafts as pending
    # (exact follow-up field depends on form_data shape — use draft count as proxy)
    pending_q = (
        select(func.count())
        .select_from(Assessment)
        .where(Assessment.status == "draft")
    )
    if base_where:
        pending_q = pending_q.where(*base_where)
    pending_followups: int = (await db.execute(pending_q)).scalar_one()

    return DoctorKpis(
        total_patients=total_patients,
        this_month_submitted=this_month_submitted,
        drafts=drafts,
        locked=locked,
        today_visits=today_visits,
        pending_followups=pending_followups,
    )


# ---------------------------------------------------------------------------
# GET /  — paginated list
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=PaginatedResponse[AssessmentResponse],
    summary="List assessments (paginated, doctor-scoped or admin all)",
)
async def list_assessments(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: draft, submitted, locked"),
    disease_id: Optional[int] = Query(None, description="Filter by disease id"),
    patient_id: Optional[int] = Query(None, description="Filter by patient id"),
    current_user: User = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AssessmentResponse]:
    q = select(Assessment)

    # Doctor-scoped: doctors only see their own
    if current_user.role == "doctor":
        q = q.where(Assessment.doctor_id == current_user.id)

    if status_filter:
        q = q.where(Assessment.status == status_filter)
    if disease_id is not None:
        q = q.where(Assessment.disease_id == disease_id)
    if patient_id is not None:
        q = q.where(Assessment.patient_id == patient_id)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    result = await db.execute(
        q.options(
            selectinload(Assessment.patient),
            selectinload(Assessment.disease),
            selectinload(Assessment.sub_disease),
        )
        .order_by(Assessment.created_at.desc()).offset(offset).limit(page_size)
    )
    assessments = result.scalars().all()

    # Build response with denormalized names
    items = []
    for a in assessments:
        resp = AssessmentResponse.model_validate(a)
        if a.patient:
            resp.patient_name = f"{a.patient.first_name} {a.patient.last_name}".strip()
            resp.patient_uid = a.patient.patient_uid
        if a.disease:
            resp.disease_name = a.disease.name
        if a.sub_disease:
            resp.sub_disease_name = a.sub_disease.name
        items.append(resp)

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# POST /  — create assessment in draft state
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new assessment in draft state",
)
async def create_assessment(
    payload: CreateAssessmentDto,
    current_user: User = Depends(role_required(_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    # Load the template to snapshot its schema
    template_result = await db.execute(
        select(FormTemplate).where(
            FormTemplate.id == payload.template_id,
            FormTemplate.is_active.is_(True),
        )
    )
    template: Optional[FormTemplate] = template_result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active form template with id={payload.template_id} not found",
        )

    assessment = Assessment(
        patient_id=payload.patient_id,
        disease_id=payload.disease_id,
        sub_disease_id=payload.sub_disease_id,
        template_id=payload.template_id,
        template_snapshot=dict(template.schema),  # snapshot at creation time
        form_data={},
        status="draft",
        consent_given=False,
        doctor_id=current_user.id,
    )
    db.add(assessment)
    await db.flush()  # populate assessment.id

    await _audit(
        db,
        event_type="assessment_created",
        actor=current_user,
        entity_type="assessment",
        entity_id=assessment.id,
        description=(
            f"Assessment created for patient_id={payload.patient_id}, "
            f"disease_id={payload.disease_id}, template_id={payload.template_id}"
        ),
    )

    return assessment


# ---------------------------------------------------------------------------
# GET /{id}  — get full assessment with prescription_rows
# ---------------------------------------------------------------------------

@router.get(
    "/{id}",
    response_model=AssessmentDetail,
    summary="Get full assessment record with prescription rows",
)
async def get_assessment(
    id: int,
    current_user: User = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentDetail:
    assessment = await _get_assessment_or_404(
        id, current_user, db, load_prescription_rows=True, load_patient=True
    )
    resp = AssessmentDetail.model_validate(assessment)
    # Populate the 'prescriptions' alias for frontend compatibility
    resp.prescriptions = resp.prescription_rows
    # Populate patient info
    if assessment.patient:
        resp.patient = AssessmentPatientResponse.model_validate(assessment.patient)
    return resp


# ---------------------------------------------------------------------------
# PUT /{id}  — update draft OR re-submit within lock window
# ---------------------------------------------------------------------------

@router.put(
    "/{id}",
    response_model=AssessmentResponse,
    summary="Update a draft assessment or re-submit within the lock window",
)
async def update_assessment(
    id: int,
    payload: UpdateAssessmentDto,
    current_user: User = Depends(role_required(_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    assessment = await _get_assessment_or_404(id, current_user, db)

    if assessment.status == "locked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment is locked and cannot be modified",
        )

    now = datetime.now(tz=timezone.utc)

    if assessment.status == "draft":
        # Update form_data and/or consent_given for drafts
        if payload.form_data is not None:
            assessment.form_data = payload.form_data
            assessment.draft_saved_at = now
        if payload.consent_given is not None:
            assessment.consent_given = payload.consent_given

    elif assessment.status == "submitted":
        # Allow re-submit only if still within the lock window
        if assessment.lock_expires_at is not None:
            lock_expires = assessment.lock_expires_at
            # Ensure offset-aware comparison
            if lock_expires.tzinfo is None:
                lock_expires = lock_expires.replace(tzinfo=timezone.utc)
            if now > lock_expires:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Assessment lock window has expired; it is now read-only",
                )
        if payload.form_data is not None:
            assessment.form_data = payload.form_data
            # Recompute lock_expires_at from new submitted_at
            lock_window_hours = await _get_lock_window_hours(db)
            from datetime import timedelta
            assessment.submitted_at = now
            assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)
        if payload.consent_given is not None:
            assessment.consent_given = payload.consent_given

    await _audit(
        db,
        event_type="assessment_updated",
        actor=current_user,
        entity_type="assessment",
        entity_id=assessment.id,
        description=f"Assessment id={id} updated (status={assessment.status})",
    )

    return assessment


# ---------------------------------------------------------------------------
# POST /{id}/submit  — transition draft → submitted
# ---------------------------------------------------------------------------

@router.post(
    "/{id}/submit",
    response_model=AssessmentResponse,
    summary="Submit a draft assessment (draft → submitted)",
)
async def submit_assessment(
    id: int,
    current_user: User = Depends(role_required(_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    assessment = await _get_assessment_or_404(id, current_user, db)

    if assessment.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Assessment is already '{assessment.status}'; only drafts can be submitted",
        )

    if not assessment.consent_given:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Patient consent must be given before submitting the assessment",
        )

    lock_window_hours = await _get_lock_window_hours(db)
    from datetime import timedelta

    now = datetime.now(tz=timezone.utc)
    assessment.status = "submitted"
    assessment.submitted_at = now
    assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)

    await _audit(
        db,
        event_type="assessment_submitted",
        actor=current_user,
        entity_type="assessment",
        entity_id=assessment.id,
        description=(
            f"Assessment id={id} submitted; "
            f"lock_expires_at={assessment.lock_expires_at.isoformat()}"
        ),
    )

    return assessment

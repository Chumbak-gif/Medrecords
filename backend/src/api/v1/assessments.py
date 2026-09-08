"""Assessments router — thin controller preserving all existing endpoint behavior."""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import get_db
from src.api.v1.schemas.assessment import (
    AssessmentDetail,
    AssessmentPatientResponse,
    AssessmentResponse,
    CreateAssessmentDto,
    DoctorKpis,
    UpdateAssessmentDto,
)
from src.api.v1.schemas.common import PaginatedResponse
from src.infrastructure.persistence.models.app_config_model import AppConfigModel
from src.infrastructure.persistence.models.assessment_model import AssessmentModel
from src.infrastructure.persistence.models.audit_log_model import AuditLogModel
from src.infrastructure.persistence.models.form_template_model import FormTemplateModel
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Assessments"])

_READ_ROLES = ["doctor", "admin", "sys_admin"]
_WRITE_ROLES = ["doctor"]


async def _audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor: UserModel,
    entity_type: str,
    entity_id: int,
    description: str,
) -> None:
    db.add(
        AuditLogModel(
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
    result = await db.execute(
        select(AppConfigModel).where(AppConfigModel.config_key == "lock_window_hours")
    )
    config = result.scalar_one_or_none()
    if config is None:
        return 24
    try:
        return int(config.config_value)
    except (ValueError, TypeError):
        return 24


async def _get_assessment_or_404(
    assessment_id: int,
    current_user: UserModel,
    db: AsyncSession,
    *,
    load_prescription_rows: bool = False,
    load_patient: bool = False,
) -> AssessmentModel:
    q = select(AssessmentModel).where(AssessmentModel.id == assessment_id)
    if load_prescription_rows:
        q = q.options(selectinload(AssessmentModel.prescription_rows))
    if load_patient:
        q = q.options(selectinload(AssessmentModel.patient))

    result = await db.execute(q)
    assessment: Optional[AssessmentModel] = result.scalar_one_or_none()

    if assessment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    if current_user.role == "doctor" and assessment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this assessment",
        )

    return assessment


# ---------------------------------------------------------------------------
# GET /dashboard/kpis
# ---------------------------------------------------------------------------

@router.get(
    "/dashboard/kpis",
    response_model=DoctorKpis,
    summary="Doctor KPI aggregates for the dashboard",
)
async def get_dashboard_kpis(
    current_user: UserModel = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> DoctorKpis:
    base_where = []
    if current_user.role == "doctor":
        base_where.append(AssessmentModel.doctor_id == current_user.id)

    total_patients_q = select(func.count(AssessmentModel.patient_id.distinct()))
    if base_where:
        total_patients_q = total_patients_q.where(*base_where)
    total_patients: int = (await db.execute(total_patients_q)).scalar_one()

    now = datetime.now(tz=timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    this_month_q = (
        select(func.count())
        .select_from(AssessmentModel)
        .where(
            AssessmentModel.status.in_(["submitted", "locked"]),
            AssessmentModel.submitted_at >= month_start,
        )
    )
    if base_where:
        this_month_q = this_month_q.where(*base_where)
    this_month_submitted: int = (await db.execute(this_month_q)).scalar_one()

    drafts_q = (
        select(func.count())
        .select_from(AssessmentModel)
        .where(AssessmentModel.status == "draft")
    )
    if base_where:
        drafts_q = drafts_q.where(*base_where)
    drafts: int = (await db.execute(drafts_q)).scalar_one()

    locked_q = (
        select(func.count())
        .select_from(AssessmentModel)
        .where(AssessmentModel.status == "locked")
    )
    if base_where:
        locked_q = locked_q.where(*base_where)
    locked: int = (await db.execute(locked_q)).scalar_one()

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_q = (
        select(func.count())
        .select_from(AssessmentModel)
        .where(
            AssessmentModel.status.in_(["submitted", "locked"]),
            AssessmentModel.submitted_at >= today_start,
        )
    )
    if base_where:
        today_q = today_q.where(*base_where)
    today_visits: int = (await db.execute(today_q)).scalar_one()

    pending_q = (
        select(func.count())
        .select_from(AssessmentModel)
        .where(AssessmentModel.status == "draft")
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
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    disease_id: Optional[int] = Query(None, description="Filter by disease id"),
    patient_id: Optional[int] = Query(None, description="Filter by patient id"),
    current_user: UserModel = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AssessmentResponse]:
    q = select(AssessmentModel)

    if current_user.role == "doctor":
        q = q.where(AssessmentModel.doctor_id == current_user.id)

    if status_filter:
        q = q.where(AssessmentModel.status == status_filter)
    if disease_id is not None:
        q = q.where(AssessmentModel.disease_id == disease_id)
    if patient_id is not None:
        q = q.where(AssessmentModel.patient_id == patient_id)

    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        q.options(
            selectinload(AssessmentModel.patient),
            selectinload(AssessmentModel.disease),
            selectinload(AssessmentModel.sub_disease),
        )
        .order_by(AssessmentModel.created_at.desc()).offset(offset).limit(page_size)
    )
    assessments = result.scalars().all()

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
# POST /  — create assessment
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new assessment in draft state",
)
async def create_assessment(
    payload: CreateAssessmentDto,
    current_user: UserModel = Depends(role_required(_WRITE_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentResponse:
    template_result = await db.execute(
        select(FormTemplateModel).where(
            FormTemplateModel.id == payload.template_id,
            FormTemplateModel.is_active.is_(True),
        )
    )
    template: Optional[FormTemplateModel] = template_result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active form template with id={payload.template_id} not found",
        )

    assessment = AssessmentModel(
        patient_id=payload.patient_id,
        disease_id=payload.disease_id,
        sub_disease_id=payload.sub_disease_id,
        template_id=payload.template_id,
        template_snapshot=dict(template.schema),
        form_data={},
        status="draft",
        consent_given=False,
        doctor_id=current_user.id,
    )
    db.add(assessment)
    await db.flush()

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
# GET /{id}
# ---------------------------------------------------------------------------

@router.get(
    "/{id}",
    response_model=AssessmentDetail,
    summary="Get full assessment record with prescription rows",
)
async def get_assessment(
    id: int,
    current_user: UserModel = Depends(role_required(_READ_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AssessmentDetail:
    assessment = await _get_assessment_or_404(
        id, current_user, db, load_prescription_rows=True, load_patient=True
    )
    resp = AssessmentDetail.model_validate(assessment)
    resp.prescriptions = resp.prescription_rows
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
    current_user: UserModel = Depends(role_required(_WRITE_ROLES)),
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
        if payload.form_data is not None:
            assessment.form_data = payload.form_data
            assessment.draft_saved_at = now
        if payload.consent_given is not None:
            assessment.consent_given = payload.consent_given

    elif assessment.status == "submitted":
        if assessment.lock_expires_at is not None:
            lock_expires = assessment.lock_expires_at
            if lock_expires.tzinfo is None:
                lock_expires = lock_expires.replace(tzinfo=timezone.utc)
            if now > lock_expires:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Assessment lock window has expired; it is now read-only",
                )
        if payload.form_data is not None:
            assessment.form_data = payload.form_data
            lock_window_hours = await _get_lock_window_hours(db)
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
# POST /{id}/submit
# ---------------------------------------------------------------------------

@router.post(
    "/{id}/submit",
    response_model=AssessmentResponse,
    summary="Submit a draft assessment (draft → submitted)",
)
async def submit_assessment(
    id: int,
    current_user: UserModel = Depends(role_required(_WRITE_ROLES)),
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

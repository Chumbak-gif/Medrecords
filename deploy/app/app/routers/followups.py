"""
Follow-ups router
Prefix:  /api/v1/followups  (mounted in main.py)
"""
import math
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import role_required
from app.models.assessment import Assessment
from app.models.disease import Disease
from app.models.followup import Followup
from app.models.patient import Patient
from app.models.user import User
from app.schemas.disease import PaginatedResponse
from app.schemas.followup import (
    FollowupCreate,
    FollowupDashboard,
    FollowupResponse,
    FollowupUpdate,
)

router = APIRouter(tags=["Follow-ups"])

# ---------------------------------------------------------------------------
# Valid state transitions
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
}


# ---------------------------------------------------------------------------
# Helper — populate denormalized fields on a FollowupResponse
# ---------------------------------------------------------------------------
async def _enrich_followup(followup: Followup, db: AsyncSession) -> FollowupResponse:
    """Build a FollowupResponse with denormalized patient_name, patient_uid, disease_name."""
    # Load patient
    patient_result = await db.execute(
        select(Patient).where(Patient.id == followup.patient_id)
    )
    patient: Optional[Patient] = patient_result.scalar_one_or_none()

    patient_name: Optional[str] = None
    patient_uid: Optional[str] = None
    if patient:
        patient_name = f"{patient.first_name} {patient.last_name}"
        patient_uid = patient.patient_uid

    # Load disease_name via assessment → disease
    disease_name: Optional[str] = None
    if followup.assessment_id:
        assessment_result = await db.execute(
            select(Assessment).where(Assessment.id == followup.assessment_id)
        )
        assessment: Optional[Assessment] = assessment_result.scalar_one_or_none()
        if assessment and assessment.disease_id:
            disease_result = await db.execute(
                select(Disease).where(Disease.id == assessment.disease_id)
            )
            disease: Optional[Disease] = disease_result.scalar_one_or_none()
            if disease:
                disease_name = disease.name

    return FollowupResponse(
        id=followup.id,
        patient_id=followup.patient_id,
        doctor_id=followup.doctor_id,
        assessment_id=followup.assessment_id,
        scheduled_date=followup.scheduled_date,
        notes=followup.notes,
        status=followup.status,
        created_at=followup.created_at,
        updated_at=followup.updated_at,
        patient_name=patient_name,
        patient_uid=patient_uid,
        disease_name=disease_name,
    )


# ===========================================================================
# POST / — Create a follow-up (doctor only)
# ===========================================================================
@router.post("/", response_model=FollowupResponse, status_code=status.HTTP_201_CREATED)
async def create_followup(
    payload: FollowupCreate,
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> FollowupResponse:
    # Validate patient exists
    patient_result = await db.execute(
        select(Patient).where(Patient.id == payload.patient_id)
    )
    if patient_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    # Validate assessment exists if provided
    if payload.assessment_id is not None:
        assessment_result = await db.execute(
            select(Assessment).where(Assessment.id == payload.assessment_id)
        )
        if assessment_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found",
            )

    followup = Followup(
        patient_id=payload.patient_id,
        doctor_id=current_user.id,
        assessment_id=payload.assessment_id,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
        status="pending",
    )
    db.add(followup)
    await db.flush()
    await db.refresh(followup)

    return await _enrich_followup(followup, db)


# ===========================================================================
# GET / — Paginated list scoped to current doctor
# ===========================================================================
@router.get("/", response_model=PaginatedResponse[FollowupResponse])
async def list_followups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[int] = Query(None),
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[FollowupResponse]:
    q = select(Followup).where(Followup.doctor_id == current_user.id)

    if status_filter is not None:
        q = q.where(Followup.status == status_filter)
    if patient_id is not None:
        q = q.where(Followup.patient_id == patient_id)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    result = await db.execute(
        q.order_by(Followup.scheduled_date.asc()).offset(offset).limit(page_size)
    )
    followups = result.scalars().all()

    items = [await _enrich_followup(f, db) for f in followups]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ===========================================================================
# GET /dashboard — Dashboard aggregates (MUST be before /{id})
# ===========================================================================
@router.get("/dashboard", response_model=FollowupDashboard)
async def get_followup_dashboard(
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> FollowupDashboard:
    # Pending count
    pending_count_result = await db.execute(
        select(func.count()).select_from(
            select(Followup)
            .where(Followup.doctor_id == current_user.id)
            .where(Followup.status == "pending")
            .subquery()
        )
    )
    pending_count: int = pending_count_result.scalar_one()

    # Today's follow-ups
    today = date_type.today()
    today_result = await db.execute(
        select(Followup)
        .where(Followup.doctor_id == current_user.id)
        .where(Followup.scheduled_date == today)
        .where(Followup.status == "pending")
        .order_by(Followup.scheduled_date.asc())
    )
    today_followups = today_result.scalars().all()

    today_items = [await _enrich_followup(f, db) for f in today_followups]

    return FollowupDashboard(
        pending_count=pending_count,
        today_followups=today_items,
    )


# ===========================================================================
# GET /calendar — All follow-ups within a date range (no pagination)
# ===========================================================================
@router.get("/calendar", response_model=list[FollowupResponse])
async def list_followups_calendar(
    start_date: date_type = Query(..., description="Range start (inclusive)"),
    end_date: date_type = Query(..., description="Range end (inclusive)"),
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> list[FollowupResponse]:
    """Return all follow-ups for the authenticated doctor within a date range."""
    # Validate: end_date >= start_date
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be greater than or equal to start_date",
        )

    # Validate: range <= 42 days
    delta = (end_date - start_date).days
    if delta > 42:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Date range must not exceed 42 days",
        )

    q = (
        select(Followup)
        .where(Followup.doctor_id == current_user.id)
        .where(Followup.scheduled_date >= start_date)
        .where(Followup.scheduled_date <= end_date)
        .order_by(Followup.scheduled_date.asc())
    )
    result = await db.execute(q)
    followups = result.scalars().all()

    return [await _enrich_followup(f, db) for f in followups]


# ===========================================================================
# GET /{id} — Single follow-up scoped to current doctor
# ===========================================================================
@router.get("/{id}", response_model=FollowupResponse)
async def get_followup(
    id: int,
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> FollowupResponse:
    result = await db.execute(select(Followup).where(Followup.id == id))
    followup: Optional[Followup] = result.scalar_one_or_none()

    if followup is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found",
        )

    if followup.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this follow-up",
        )

    return await _enrich_followup(followup, db)


# ===========================================================================
# PATCH /{id} — Update follow-up with state machine enforcement
# ===========================================================================
@router.patch("/{id}", response_model=FollowupResponse)
async def update_followup(
    id: int,
    payload: FollowupUpdate,
    current_user: User = Depends(role_required(["doctor"])),
    db: AsyncSession = Depends(get_db),
) -> FollowupResponse:
    result = await db.execute(select(Followup).where(Followup.id == id))
    followup: Optional[Followup] = result.scalar_one_or_none()

    if followup is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow-up not found",
        )

    if followup.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this follow-up",
        )

    # State machine enforcement
    if payload.status is not None and payload.status != followup.status:
        allowed = VALID_TRANSITIONS.get(followup.status, [])
        if payload.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot transition from '{followup.status}' to '{payload.status}'. "
                    f"Allowed transitions: {allowed or 'none'}"
                ),
            )
        followup.status = payload.status

    if payload.scheduled_date is not None:
        followup.scheduled_date = payload.scheduled_date

    if payload.notes is not None:
        followup.notes = payload.notes

    await db.flush()
    await db.refresh(followup)

    return await _enrich_followup(followup, db)

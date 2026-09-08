"""Follow-ups router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import (
    get_create_followup_use_case,
    get_followup_dashboard_use_case,
    get_get_followup_use_case,
    get_list_calendar_followups_use_case,
    get_list_followups_use_case,
    get_update_followup_use_case,
)
from src.api.v1.schemas.common import PaginatedResponse
from src.application.use_cases.followups.create_followup import CreateFollowupCommand, CreateFollowupUseCase
from src.application.use_cases.followups.get_dashboard import GetDashboardQuery, GetFollowupDashboardUseCase
from src.application.use_cases.followups.get_followup import GetFollowupQuery, GetFollowupUseCase
from src.application.use_cases.followups.list_calendar import ListCalendarQuery, ListCalendarFollowupsUseCase
from src.application.use_cases.followups.list_followups import ListFollowupsQuery, ListFollowupsUseCase
from src.application.use_cases.followups.update_followup import UpdateFollowupCommand, UpdateFollowupUseCase
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ValidationError as DomainValidationError
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Follow-ups"])


# --- Schemas ---

class FollowupCreate(BaseModel):
    patient_id: int
    assessment_id: Optional[int] = None
    scheduled_date: date
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("scheduled_date")
    @classmethod
    def date_must_be_future(cls, v: date) -> date:
        today = date_type.today()
        delta = (v - today).days
        if delta < 1:
            raise ValueError("scheduled_date must be at least 1 day in the future")
        if delta > 365:
            raise ValueError("scheduled_date must be no more than 365 days from today")
        return v


class FollowupUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "completed", "cancelled"):
            raise ValueError("status must be one of: pending, completed, cancelled")
        return v

    @field_validator("scheduled_date")
    @classmethod
    def date_must_be_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            today = date_type.today()
            delta = (v - today).days
            if delta < 1:
                raise ValueError("scheduled_date must be at least 1 day in the future")
            if delta > 365:
                raise ValueError("scheduled_date must be no more than 365 days from today")
        return v


class FollowupResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    assessment_id: Optional[int] = None
    scheduled_date: date
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    patient_name: Optional[str] = None
    patient_uid: Optional[str] = None
    disease_name: Optional[str] = None

    model_config = {"from_attributes": True}


class FollowupDashboard(BaseModel):
    pending_count: int
    today_followups: list[FollowupResponse]


# --- Helpers ---

def _to_actor(user_model: UserModel) -> UserEntity:
    return UserEntity(
        id=user_model.id,
        username=user_model.username,
        email=user_model.email,
        full_name=user_model.full_name,
        hashed_password=user_model.hashed_password,
        role=user_model.role,
        specialty=user_model.specialty,
        is_active=user_model.is_active,
        created_at=user_model.created_at,
        updated_at=user_model.updated_at,
    )


def _entity_to_response(entity) -> FollowupResponse:
    """Convert a FollowupEntity to a FollowupResponse (without enrichment)."""
    return FollowupResponse(
        id=entity.id,
        patient_id=entity.patient_id,
        doctor_id=entity.doctor_id,
        assessment_id=entity.assessment_id,
        scheduled_date=entity.scheduled_date,
        notes=entity.notes,
        status=entity.status,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
        patient_name=None,
        patient_uid=None,
        disease_name=None,
    )


def _enriched_to_response(data: dict) -> FollowupResponse:
    """Convert an enriched dict from the repository to a FollowupResponse."""
    return FollowupResponse(
        id=data["id"],
        patient_id=data["patient_id"],
        doctor_id=data["doctor_id"],
        assessment_id=data["assessment_id"],
        scheduled_date=data["scheduled_date"],
        notes=data["notes"],
        status=data["status"],
        created_at=data["created_at"],
        updated_at=data["updated_at"],
        patient_name=data.get("patient_name"),
        patient_uid=data.get("patient_uid"),
        disease_name=data.get("disease_name"),
    )


# --- Endpoints ---

@router.post("/", response_model=FollowupResponse, status_code=status.HTTP_201_CREATED)
async def create_followup(
    payload: FollowupCreate,
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: CreateFollowupUseCase = Depends(get_create_followup_use_case),
    get_followup_uc: GetFollowupUseCase = Depends(get_get_followup_use_case),
) -> FollowupResponse:
    command = CreateFollowupCommand(
        patient_id=payload.patient_id,
        assessment_id=payload.assessment_id,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
        actor=_to_actor(current_user),
    )
    followup = await use_case.execute(command)
    # Enrich response data via the repository
    enriched = await get_followup_uc._followup_repo.get_enriched(followup.id)
    if enriched:
        return _enriched_to_response(enriched)
    return _entity_to_response(followup)


@router.get("/", response_model=PaginatedResponse[FollowupResponse])
async def list_followups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[int] = Query(None),
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: ListFollowupsUseCase = Depends(get_list_followups_use_case),
) -> PaginatedResponse[FollowupResponse]:
    actor = _to_actor(current_user)
    query = ListFollowupsQuery(
        page=page,
        page_size=page_size,
        status=status_filter,
        patient_id=patient_id,
        actor=actor,
    )
    result = await use_case.execute(query)

    # Get enriched data from the repo
    enriched_items = await use_case._followup_repo.list_enriched(
        offset=(page - 1) * page_size,
        limit=page_size,
        doctor_id=actor.id,
        patient_id=patient_id,
        status=status_filter,
    )

    return PaginatedResponse(
        items=[_enriched_to_response(item) for item in enriched_items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.get("/dashboard", response_model=FollowupDashboard)
async def get_followup_dashboard(
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: GetFollowupDashboardUseCase = Depends(get_followup_dashboard_use_case),
) -> FollowupDashboard:
    actor = _to_actor(current_user)
    query = GetDashboardQuery(actor=actor)
    result = await use_case.execute(query)

    # Enrich today's followups
    today = date_type.today()
    enriched_today = await use_case._followup_repo.list_enriched(
        offset=0,
        limit=1000,
        doctor_id=actor.id,
        status="pending",
        scheduled_from=today,
        scheduled_to=today,
    )

    return FollowupDashboard(
        pending_count=result.pending_count,
        today_followups=[_enriched_to_response(item) for item in enriched_today],
    )


@router.get("/calendar", response_model=list[FollowupResponse])
async def list_followups_calendar(
    start_date: date_type = Query(..., description="Range start (inclusive)"),
    end_date: date_type = Query(..., description="Range end (inclusive)"),
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: ListCalendarFollowupsUseCase = Depends(get_list_calendar_followups_use_case),
) -> list[FollowupResponse]:
    actor = _to_actor(current_user)
    try:
        query = ListCalendarQuery(
            start_date=start_date,
            end_date=end_date,
            actor=actor,
        )
        await use_case.execute(query)
    except DomainValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    # Get enriched data
    enriched = await use_case._followup_repo.list_enriched(
        offset=0,
        limit=10000,
        doctor_id=actor.id,
        scheduled_from=start_date,
        scheduled_to=end_date,
    )
    return [_enriched_to_response(item) for item in enriched]


@router.get("/{id}", response_model=FollowupResponse)
async def get_followup(
    id: int,
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: GetFollowupUseCase = Depends(get_get_followup_use_case),
) -> FollowupResponse:
    actor = _to_actor(current_user)
    query = GetFollowupQuery(followup_id=id, actor=actor)
    await use_case.execute(query)  # validates ownership

    enriched = await use_case._followup_repo.get_enriched(id)
    if enriched:
        return _enriched_to_response(enriched)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")


@router.patch("/{id}", response_model=FollowupResponse)
async def update_followup(
    id: int,
    payload: FollowupUpdate,
    current_user: UserModel = Depends(role_required(["doctor"])),
    use_case: UpdateFollowupUseCase = Depends(get_update_followup_use_case),
) -> FollowupResponse:
    actor = _to_actor(current_user)
    command = UpdateFollowupCommand(
        followup_id=id,
        status=payload.status,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
        actor=actor,
    )
    await use_case.execute(command)

    enriched = await use_case._followup_repo.get_enriched(id)
    if enriched:
        return _enriched_to_response(enriched)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")

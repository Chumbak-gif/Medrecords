"""Audit router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel

from src.api.v1.dependencies.auth import get_current_user, role_required
from src.api.v1.dependencies.container import (
    get_create_audit_log_use_case,
    get_list_audit_logs_use_case,
)
from src.api.v1.schemas.common import PaginatedResponse
from src.application.use_cases.audit.create_audit_log import CreateAuditLogCommand, CreateAuditLogUseCase
from src.application.use_cases.audit.list_audit_logs import ListAuditLogsQuery, ListAuditLogsUseCase
from src.domain.entities.user import UserEntity
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Audit"])

_ADMIN_ROLES = ["admin", "sys_admin"]


# --- Schemas ---

class AuditLogCreate(BaseModel):
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    event_type: str
    actor_id: Optional[int] = None
    actor_username: str
    actor_role: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


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


# --- Endpoints ---

@router.get(
    "/",
    response_model=PaginatedResponse[AuditLogResponse],
    summary="Paginated audit log with filters",
)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    event_type: Optional[str] = Query(None, description="Filter by event_type"),
    actor_username: Optional[str] = Query(None, description="Filter by actor_username"),
    from_date: Optional[date] = Query(None, description="Filter from date (inclusive)"),
    to_date: Optional[date] = Query(None, description="Filter to date (inclusive)"),
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    use_case: ListAuditLogsUseCase = Depends(get_list_audit_logs_use_case),
) -> PaginatedResponse[AuditLogResponse]:
    query = ListAuditLogsQuery(
        page=page,
        page_size=page_size,
        event_type=event_type,
        actor_username=actor_username,
        from_date=from_date,
        to_date=to_date,
        actor=_to_actor(current_user),
    )
    result = await use_case.execute(query)
    return PaginatedResponse(
        items=[AuditLogResponse.model_validate(log) for log in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post(
    "/",
    response_model=AuditLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an audit log entry (all authenticated roles)",
)
async def create_audit_log(
    body: AuditLogCreate,
    request: Request,
    current_user: UserModel = Depends(get_current_user),
    use_case: CreateAuditLogUseCase = Depends(get_create_audit_log_use_case),
) -> AuditLogResponse:
    ip = request.client.host if request.client else None
    command = CreateAuditLogCommand(
        event_type=body.event_type,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        description=body.description,
        ip_address=ip,
        actor=_to_actor(current_user),
    )
    entry = await use_case.execute(command)
    return AuditLogResponse.model_validate(entry)

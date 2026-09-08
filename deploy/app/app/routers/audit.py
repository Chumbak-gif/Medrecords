"""
Audit router
Prefix:  /api/v1/audit  (mounted in main.py)

Access control:
  GET  /  — admin, sys_admin (paginated audit log)
  POST /  — all authenticated roles (client-side audit event logging)
"""

import math
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.schemas.disease import PaginatedResponse

router = APIRouter(tags=["Audit"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_ALL_ROLES = ["doctor", "admin", "sys_admin", "pharma"]


# ---------------------------------------------------------------------------
# Pydantic schema for creating audit log entries from the frontend
# ---------------------------------------------------------------------------

class AuditLogCreate(BaseModel):
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /  — paginated audit log
# ---------------------------------------------------------------------------

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
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AuditLogResponse]:
    q = select(AuditLog)

    if event_type:
        q = q.where(AuditLog.event_type == event_type)
    if actor_username:
        q = q.where(AuditLog.actor_username.ilike(f"%{actor_username}%"))
    if from_date is not None:
        q = q.where(
            AuditLog.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        )
    if to_date is not None:
        q = q.where(
            AuditLog.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        )

    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        q.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    )
    logs = result.scalars().all()

    return PaginatedResponse(
        items=logs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# POST /  — create an audit log entry (client-initiated events)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=AuditLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an audit log entry (all authenticated roles)",
)
async def create_audit_log(
    body: AuditLogCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditLog:
    ip = request.client.host if request.client else None
    entry = AuditLog(
        event_type=body.event_type,
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role=current_user.role,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        description=body.description,
        ip_address=ip,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry

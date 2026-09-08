"""
Users router
Prefix:  /api/v1/users  (mounted in main.py)

Access control:
  GET    /                — admin, sys_admin (paginated)
  POST   /                — sys_admin only (create any role)
  GET    /{id}            — admin, sys_admin
  PATCH  /{id}            — admin, sys_admin (not password)
  DELETE /{id}            — sys_admin only (soft-delete)
  POST   /{id}/reset-password — admin, sys_admin
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from passlib.context import CryptContext
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import role_required
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.disease import PaginatedResponse
from app.schemas.user import ResetPasswordPayload, UserCreate, UserResponse, UserUpdate

router = APIRouter(tags=["Users"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_SYS_ADMIN_ROLES = ["sys_admin"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


async def _get_user_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user: Optional[User] = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# GET /  — paginated list
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=PaginatedResponse[UserResponse],
    summary="Paginated list of all users",
)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search term matched against username, email, or full_name"),
    role: Optional[str] = Query(None, description="Filter by role"),
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[UserResponse]:
    q = select(User)

    if search:
        like = f"%{search}%"
        q = q.where(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like),
            )
        )
    if role:
        q = q.where(User.role == role)

    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        q.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    )
    users = result.scalars().all()

    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ---------------------------------------------------------------------------
# POST /  — create user (sys_admin only)
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (admin/sys_admin)",
)
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Check uniqueness
    dup = await db.execute(
        select(User).where(
            or_(User.username == payload.username, User.email == payload.email)
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this username or email already exists",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=pwd_context.hash(payload.password),
        role=payload.role,
        specialty=payload.specialty,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await _audit(
        db,
        event_type="user_created",
        actor=current_user,
        entity_type="user",
        entity_id=user.id,
        description=f"User '{user.username}' (role={user.role}) created by sys_admin",
    )

    return user


# ---------------------------------------------------------------------------
# GET /{id}  — get user by id
# ---------------------------------------------------------------------------

@router.get(
    "/{id}",
    response_model=UserResponse,
    summary="Get user by id",
)
async def get_user(
    id: int,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    return await _get_user_or_404(id, db)


# ---------------------------------------------------------------------------
# PATCH /{id}  — update user (not password)
# ---------------------------------------------------------------------------

@router.patch(
    "/{id}",
    response_model=UserResponse,
    summary="Update user fields (not password)",
)
async def update_user(
    id: int,
    payload: UserUpdate,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await _get_user_or_404(id, db)

    if payload.email is not None and payload.email != user.email:
        dup = await db.execute(
            select(User).where(User.email == payload.email, User.id != id)
        )
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )
        user.email = payload.email

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.specialty is not None:
        user.specialty = payload.specialty
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await _audit(
        db,
        event_type="user_updated",
        actor=current_user,
        entity_type="user",
        entity_id=user.id,
        description=f"User '{user.username}' updated",
    )

    return user


# ---------------------------------------------------------------------------
# DELETE /{id}  — soft-delete (sys_admin only)
# ---------------------------------------------------------------------------

@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a user (admin/sys_admin)",
)
async def delete_user(
    id: int,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user_or_404(id, db)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already inactive",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user.is_active = False

    await _audit(
        db,
        event_type="user_deleted",
        actor=current_user,
        entity_type="user",
        entity_id=user.id,
        description=f"User '{user.username}' soft-deleted",
    )


# ---------------------------------------------------------------------------
# POST /{id}/reset-password
# ---------------------------------------------------------------------------

@router.post(
    "/{id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset user password (admin/sys_admin)",
)
async def reset_password(
    id: int,
    payload: ResetPasswordPayload,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await _get_user_or_404(id, db)

    user.hashed_password = pwd_context.hash(payload.password)

    await _audit(
        db,
        event_type="user_password_reset",
        actor=current_user,
        entity_type="user",
        entity_id=user.id,
        description=f"Password reset for user '{user.username}'",
    )

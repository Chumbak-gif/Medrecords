"""Users router — thin controller delegating to UserService.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import get_db
from src.api.v1.schemas.common import PaginatedResponse
from src.application.services.user_service import UserService
from src.domain.entities.user import UserEntity
from src.domain.services.access_control import AccessControlService
from src.infrastructure.persistence.repositories.user_repository_impl import SqlAlchemyUserRepository
from src.infrastructure.persistence.repositories.audit_log_repository_impl import SqlAlchemyAuditLogRepository
from src.infrastructure.persistence.services.password_hasher import BcryptPasswordHasher
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from src.infrastructure.persistence.database import async_session_factory
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Users"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_SYS_ADMIN_ROLES = ["sys_admin"]


# --- DI Factory ---

def _get_user_service(
    session: AsyncSession = Depends(get_db),
) -> UserService:
    user_repo = SqlAlchemyUserRepository(session)
    audit_repo = SqlAlchemyAuditLogRepository(session)
    return UserService(
        user_repo=user_repo,
        audit_repo=audit_repo,
        access_control=AccessControlService(),
        password_hasher=BcryptPasswordHasher(),
        uow=SqlAlchemyUnitOfWork(async_session_factory),
    )


# --- Schemas ---

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: str
    specialty: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"doctor", "admin", "pharma_viewer", "sys_admin"}
        if v not in allowed:
            raise ValueError(f"role must be one of {sorted(allowed)}")
        return v

    @field_validator("username")
    @classmethod
    def username_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username must not be blank")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            allowed = {"doctor", "admin", "pharma_viewer", "sys_admin"}
            if v not in allowed:
                raise ValueError(f"role must be one of {sorted(allowed)}")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    specialty: Optional[str] = None
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResetPasswordPayload(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


# --- Helpers ---

def _to_actor(user_model: UserModel) -> UserEntity:
    """Convert the authenticated UserModel to a domain UserEntity for service actors."""
    return UserEntity(
        id=user_model.id,
        username=user_model.username,
        email=user_model.email,
        full_name=user_model.full_name,
        hashed_password=user_model.hashed_password,
        role=user_model.role,
        specialty=user_model.specialty,
        is_active=user_model.is_active,
        must_change_password=user_model.must_change_password,
        created_at=user_model.created_at,
        updated_at=user_model.updated_at,
    )


# --- Endpoints ---

@router.get("/", response_model=PaginatedResponse[UserResponse], summary="Paginated list of all users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    role: Optional[str] = Query(None),
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> PaginatedResponse[UserResponse]:
    try:
        result = await service.list_users(
            page=page, page_size=page_size, search=search, role=role, actor=_to_actor(current_user)
        )
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return PaginatedResponse(
        items=result.items,
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Create a new user (sys_admin only)")
async def create_user(
    payload: UserCreate,
    current_user: UserModel = Depends(role_required(_SYS_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> UserResponse:
    try:
        user = await service.create_user(
            username=payload.username,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role=payload.role,
            specialty=payload.specialty,
            actor=_to_actor(current_user),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return UserResponse.model_validate(user)


@router.get("/{id}", response_model=UserResponse, summary="Get user by id")
async def get_user(
    id: int,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> UserResponse:
    try:
        user = await service.get_user(user_id=id, actor=_to_actor(current_user))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return UserResponse.model_validate(user)


@router.patch("/{id}", response_model=UserResponse, summary="Update user fields (not password)")
async def update_user(
    id: int,
    payload: UserUpdate,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> UserResponse:
    try:
        user = await service.update_user(
            user_id=id,
            email=payload.email,
            full_name=payload.full_name,
            role=payload.role,
            specialty=payload.specialty,
            is_active=payload.is_active,
            actor=_to_actor(current_user),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return UserResponse.model_validate(user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Soft-delete a user (sys_admin only)")
async def delete_user(
    id: int,
    current_user: UserModel = Depends(role_required(_SYS_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> None:
    try:
        await service.delete_user(user_id=id, actor=_to_actor(current_user))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{id}/reset-password", status_code=status.HTTP_204_NO_CONTENT, summary="Reset user password (admin/sys_admin)")
async def reset_password(
    id: int,
    payload: ResetPasswordPayload,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: UserService = Depends(_get_user_service),
) -> None:
    try:
        await service.reset_password(
            user_id=id, new_password=payload.password, actor=_to_actor(current_user)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

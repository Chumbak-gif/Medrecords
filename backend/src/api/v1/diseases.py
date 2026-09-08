"""Disease & Sub-Disease router — thin controller delegating to DiseaseService.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.dependencies.auth import get_current_user, role_required
from src.api.v1.dependencies.container import get_db
from src.api.v1.schemas.common import PaginatedResponse
from src.application.services.disease_service import DiseaseService
from src.domain.entities.user import UserEntity
from src.domain.services.access_control import AccessControlService
from src.infrastructure.persistence.repositories.disease_repository_impl import SqlAlchemyDiseaseRepository
from src.infrastructure.persistence.repositories.audit_log_repository_impl import SqlAlchemyAuditLogRepository
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from src.infrastructure.persistence.database import async_session_factory
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Diseases"])

_ADMIN_ROLES = ["admin", "sys_admin"]


# --- DI Factory ---

def _get_disease_service(
    session: AsyncSession = Depends(get_db),
) -> DiseaseService:
    disease_repo = SqlAlchemyDiseaseRepository(session)
    audit_repo = SqlAlchemyAuditLogRepository(session)
    return DiseaseService(
        disease_repo=disease_repo,
        audit_repo=audit_repo,
        access_control=AccessControlService(),
        uow=SqlAlchemyUnitOfWork(async_session_factory),
    )


# --- Schemas ---

class DiseaseCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class DiseaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("name must not be blank")
        return v


class SubDiseaseCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class SubDiseaseUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("name must not be blank")
        return v


class DiseaseResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubDiseaseResponse(BaseModel):
    id: int
    disease_id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DiseaseDetail(DiseaseResponse):
    sub_diseases: list[SubDiseaseResponse] = []


# --- Helpers ---

def _to_actor(user_model: UserModel) -> UserEntity:
    """Convert the authenticated UserModel to a domain UserEntity."""
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


# --- Disease endpoints ---

@router.get("/", response_model=PaginatedResponse[DiseaseResponse], summary="List diseases (paginated + search)")
async def list_diseases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    include_inactive: bool = Query(False),
    _current_user: UserModel = Depends(get_current_user),
    service: DiseaseService = Depends(_get_disease_service),
) -> PaginatedResponse[DiseaseResponse]:
    result = await service.list_diseases(
        page=page, page_size=page_size, search=search, include_inactive=include_inactive
    )
    return PaginatedResponse(
        items=result.items,
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post("/", response_model=DiseaseResponse, status_code=status.HTTP_201_CREATED, summary="Create a new disease (admin only)")
async def create_disease(
    payload: DiseaseCreate,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> DiseaseResponse:
    try:
        disease = await service.create_disease(
            name=payload.name, description=payload.description, actor=_to_actor(current_user)
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return DiseaseResponse.model_validate(disease)


@router.get("/{id}", response_model=DiseaseDetail, summary="Get a disease with its sub-diseases")
async def get_disease(
    id: int,
    _current_user: UserModel = Depends(get_current_user),
    service: DiseaseService = Depends(_get_disease_service),
) -> DiseaseDetail:
    try:
        result = await service.get_disease(disease_id=id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return DiseaseDetail(
        id=result.disease.id,
        name=result.disease.name,
        description=result.disease.description,
        is_active=result.disease.is_active,
        created_by=result.disease.created_by,
        created_at=result.disease.created_at,
        updated_at=result.disease.updated_at,
        sub_diseases=[SubDiseaseResponse.model_validate(sub) for sub in result.sub_diseases],
    )


@router.patch("/{id}", response_model=DiseaseResponse, summary="Update a disease (admin only)")
async def update_disease(
    id: int,
    payload: DiseaseUpdate,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> DiseaseResponse:
    try:
        disease = await service.update_disease(
            disease_id=id,
            name=payload.name,
            description=payload.description,
            is_active=payload.is_active,
            actor=_to_actor(current_user),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return DiseaseResponse.model_validate(disease)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Soft-delete a disease (admin only)")
async def delete_disease(
    id: int,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> None:
    try:
        await service.delete_disease(disease_id=id, actor=_to_actor(current_user))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{id}/restore", response_model=DiseaseResponse, summary="Restore a soft-deleted disease (admin only)")
async def restore_disease(
    id: int,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> DiseaseResponse:
    try:
        disease = await service.restore_disease(disease_id=id, actor=_to_actor(current_user))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return DiseaseResponse.model_validate(disease)


# --- Sub-Disease endpoints ---

@router.get("/{id}/sub-diseases", response_model=list[SubDiseaseResponse], summary="List sub-diseases for a disease")
async def list_sub_diseases(
    id: int,
    include_inactive: bool = Query(False),
    _current_user: UserModel = Depends(get_current_user),
    service: DiseaseService = Depends(_get_disease_service),
) -> list[SubDiseaseResponse]:
    try:
        subs = await service.list_sub_diseases(disease_id=id, include_inactive=include_inactive)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [SubDiseaseResponse.model_validate(sub) for sub in subs]


@router.post("/{id}/sub-diseases", response_model=SubDiseaseResponse, status_code=status.HTTP_201_CREATED, summary="Create a sub-disease (admin only)")
async def create_sub_disease(
    id: int,
    payload: SubDiseaseCreate,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> SubDiseaseResponse:
    try:
        sub = await service.create_sub_disease(
            disease_id=id, name=payload.name, actor=_to_actor(current_user)
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return SubDiseaseResponse.model_validate(sub)


@router.patch("/{id}/sub-diseases/{sid}", response_model=SubDiseaseResponse, summary="Update a sub-disease (admin only)")
async def update_sub_disease(
    id: int,
    sid: int,
    payload: SubDiseaseUpdate,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> SubDiseaseResponse:
    try:
        sub = await service.update_sub_disease(
            disease_id=id,
            sub_disease_id=sid,
            name=payload.name,
            is_active=payload.is_active,
            actor=_to_actor(current_user),
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return SubDiseaseResponse.model_validate(sub)


@router.delete("/{id}/sub-diseases/{sid}", status_code=status.HTTP_204_NO_CONTENT, summary="Soft-delete a sub-disease (admin only)")
async def delete_sub_disease(
    id: int,
    sid: int,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    service: DiseaseService = Depends(_get_disease_service),
) -> None:
    try:
        await service.delete_sub_disease(
            disease_id=id, sub_disease_id=sid, actor=_to_actor(current_user)
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

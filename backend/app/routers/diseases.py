"""
Disease & Sub-Disease router
Prefix:  /api/v1/diseases  (mounted in main.py)
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog
from app.models.disease import Disease, SubDisease
from app.models.user import User
from app.schemas.disease import (
    DiseaseCreate,
    DiseaseDetail,
    DiseaseResponse,
    DiseaseUpdate,
    PaginatedResponse,
    SubDiseaseCreate,
    SubDiseaseResponse,
    SubDiseaseUpdate,
)

router = APIRouter(tags=["Diseases"])

# ---------------------------------------------------------------------------
# Internal helper — write an audit log entry
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


# ===========================================================================
# Disease endpoints
# ===========================================================================

@router.get(
    "/",
    response_model=PaginatedResponse[DiseaseResponse],
    summary="List diseases (paginated + search)",
)
async def list_diseases(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query("", description="Search term matched against name"),
    include_inactive: bool = Query(False, description="Include soft-deleted diseases"),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[DiseaseResponse]:
    q = select(Disease)
    if not include_inactive:
        q = q.where(Disease.is_active.is_(True))
    if search:
        q = q.where(Disease.name.ilike(f"%{search}%"))

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    result = await db.execute(q.order_by(Disease.name).offset(offset).limit(page_size))
    diseases = result.scalars().all()

    return PaginatedResponse(
        items=diseases,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post(
    "/",
    response_model=DiseaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new disease (admin only)",
)
async def create_disease(
    payload: DiseaseCreate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> DiseaseResponse:
    # Uniqueness check (case-insensitive)
    existing = await db.execute(
        select(Disease).where(func.lower(Disease.name) == payload.name.lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A disease named '{payload.name}' already exists",
        )

    disease = Disease(
        name=payload.name,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(disease)
    await db.flush()  # populate disease.id before the audit log

    await _audit(
        db,
        event_type="disease_created",
        actor=current_user,
        entity_type="disease",
        entity_id=disease.id,
        description=f"Disease '{disease.name}' created",
    )

    return disease


@router.get(
    "/{id}",
    response_model=DiseaseDetail,
    summary="Get a disease with its sub-diseases",
)
async def get_disease(
    id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiseaseDetail:
    result = await db.execute(
        select(Disease)
        .options(selectinload(Disease.sub_diseases))
        .where(Disease.id == id)
    )
    disease: Optional[Disease] = result.scalar_one_or_none()
    if disease is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")
    return disease


@router.patch(
    "/{id}",
    response_model=DiseaseResponse,
    summary="Update a disease (admin only)",
)
async def update_disease(
    id: int,
    payload: DiseaseUpdate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> DiseaseResponse:
    result = await db.execute(select(Disease).where(Disease.id == id))
    disease: Optional[Disease] = result.scalar_one_or_none()
    if disease is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")

    if payload.name is not None and payload.name.lower() != disease.name.lower():
        existing = await db.execute(
            select(Disease).where(
                func.lower(Disease.name) == payload.name.lower(),
                Disease.id != id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A disease named '{payload.name}' already exists",
            )
        disease.name = payload.name

    if payload.description is not None:
        disease.description = payload.description
    if payload.is_active is not None:
        disease.is_active = payload.is_active

    await _audit(
        db,
        event_type="disease_updated",
        actor=current_user,
        entity_type="disease",
        entity_id=disease.id,
        description=f"Disease '{disease.name}' updated",
    )

    return disease


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a disease and all its sub-diseases (admin only)",
)
async def delete_disease(
    id: int,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Disease)
        .options(selectinload(Disease.sub_diseases))
        .where(Disease.id == id)
    )
    disease: Optional[Disease] = result.scalar_one_or_none()
    if disease is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")

    # Block if any assessments reference this disease
    assessment_count: int = (
        await db.execute(
            select(func.count())
            .select_from(Assessment)
            .where(Assessment.disease_id == id)
        )
    ).scalar_one()

    if assessment_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete disease '{disease.name}': "
                f"{assessment_count} assessment(s) are linked to it"
            ),
        )

    # Soft-delete the disease and all of its sub-diseases
    disease.is_active = False
    for sub in disease.sub_diseases:
        sub.is_active = False

    await _audit(
        db,
        event_type="disease_deleted",
        actor=current_user,
        entity_type="disease",
        entity_id=disease.id,
        description=f"Disease '{disease.name}' soft-deleted (cascaded to sub-diseases)",
    )


@router.post(
    "/{id}/restore",
    response_model=DiseaseResponse,
    summary="Restore a soft-deleted disease (admin only)",
)
async def restore_disease(
    id: int,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> DiseaseResponse:
    result = await db.execute(select(Disease).where(Disease.id == id))
    disease: Optional[Disease] = result.scalar_one_or_none()
    if disease is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")

    if disease.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Disease is already active",
        )

    disease.is_active = True

    await _audit(
        db,
        event_type="disease_restored",
        actor=current_user,
        entity_type="disease",
        entity_id=disease.id,
        description=f"Disease '{disease.name}' restored",
    )

    return disease


# ===========================================================================
# Sub-Disease endpoints
# ===========================================================================

@router.get(
    "/{id}/sub-diseases",
    response_model=list[SubDiseaseResponse],
    summary="List sub-diseases for a disease",
)
async def list_sub_diseases(
    id: int,
    include_inactive: bool = Query(False, description="Include soft-deleted sub-diseases"),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SubDiseaseResponse]:
    # Verify disease exists
    disease_result = await db.execute(select(Disease).where(Disease.id == id))
    if disease_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")

    q = select(SubDisease).where(SubDisease.disease_id == id)
    if not include_inactive:
        q = q.where(SubDisease.is_active.is_(True))

    result = await db.execute(q.order_by(SubDisease.name))
    return result.scalars().all()


@router.post(
    "/{id}/sub-diseases",
    response_model=SubDiseaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a sub-disease (admin only)",
)
async def create_sub_disease(
    id: int,
    payload: SubDiseaseCreate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> SubDiseaseResponse:
    # Verify parent disease exists
    disease_result = await db.execute(select(Disease).where(Disease.id == id))
    disease: Optional[Disease] = disease_result.scalar_one_or_none()
    if disease is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disease not found")

    # Uniqueness within disease (case-insensitive)
    existing = await db.execute(
        select(SubDisease).where(
            SubDisease.disease_id == id,
            func.lower(SubDisease.name) == payload.name.lower(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sub-disease '{payload.name}' already exists for this disease",
        )

    sub = SubDisease(disease_id=id, name=payload.name)
    db.add(sub)
    await db.flush()

    await _audit(
        db,
        event_type="sub_disease_created",
        actor=current_user,
        entity_type="sub_disease",
        entity_id=sub.id,
        description=f"Sub-disease '{sub.name}' created under disease '{disease.name}'",
    )

    return sub


@router.patch(
    "/{id}/sub-diseases/{sid}",
    response_model=SubDiseaseResponse,
    summary="Update a sub-disease (admin only)",
)
async def update_sub_disease(
    id: int,
    sid: int,
    payload: SubDiseaseUpdate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> SubDiseaseResponse:
    result = await db.execute(
        select(SubDisease).where(SubDisease.id == sid, SubDisease.disease_id == id)
    )
    sub: Optional[SubDisease] = result.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-disease not found")

    if payload.name is not None and payload.name.lower() != sub.name.lower():
        existing = await db.execute(
            select(SubDisease).where(
                SubDisease.disease_id == id,
                func.lower(SubDisease.name) == payload.name.lower(),
                SubDisease.id != sid,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Sub-disease '{payload.name}' already exists for this disease",
            )
        sub.name = payload.name

    if payload.is_active is not None:
        sub.is_active = payload.is_active

    await _audit(
        db,
        event_type="sub_disease_updated",
        actor=current_user,
        entity_type="sub_disease",
        entity_id=sub.id,
        description=f"Sub-disease '{sub.name}' (id={sub.id}) updated",
    )

    return sub


@router.delete(
    "/{id}/sub-diseases/{sid}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a sub-disease (admin only)",
)
async def delete_sub_disease(
    id: int,
    sid: int,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(SubDisease).where(SubDisease.id == sid, SubDisease.disease_id == id)
    )
    sub: Optional[SubDisease] = result.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-disease not found")

    sub.is_active = False

    await _audit(
        db,
        event_type="sub_disease_deleted",
        actor=current_user,
        entity_type="sub_disease",
        entity_id=sub.id,
        description=f"Sub-disease '{sub.name}' (id={sub.id}) soft-deleted",
    )

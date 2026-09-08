"""
Form Template router
Prefix:  /api/v1/templates  (mounted in main.py)
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.audit_log import AuditLog
from app.models.disease import Disease
from app.models.form_template import FormTemplate
from app.models.user import User
from app.schemas.disease import PaginatedResponse
from app.schemas.template import (
    FormTemplateCreate,
    FormTemplateResponse,
    FormTemplateUpdate,
)

router = APIRouter(tags=["Form Templates"])


# ---------------------------------------------------------------------------
# Internal helper — write an audit log entry
# ---------------------------------------------------------------------------

async def _audit(
    db: AsyncSession,
    *,
    event_type: str,
    actor: User,
    entity_id: int,
    description: str,
) -> None:
    db.add(
        AuditLog(
            event_type=event_type,
            actor_id=actor.id,
            actor_username=actor.username,
            actor_role=actor.role,
            entity_type="form_template",
            entity_id=entity_id,
            description=description,
        )
    )


# ===========================================================================
# GET /disease/{disease_id}/active — registered BEFORE /{id} to avoid clash
# ===========================================================================

@router.get(
    "/disease/{disease_id}/active",
    response_model=FormTemplateResponse,
    summary="Get the active template for a disease",
)
async def get_active_template_for_disease(
    disease_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FormTemplateResponse:
    result = await db.execute(
        select(FormTemplate).where(
            FormTemplate.disease_id == disease_id,
            FormTemplate.is_active.is_(True),
        )
    )
    template: Optional[FormTemplate] = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active template found for disease id={disease_id}",
        )
    return template


# ===========================================================================
# GET /  — paginated list
# ===========================================================================

@router.get(
    "/",
    response_model=PaginatedResponse[FormTemplateResponse],
    summary="List form templates (paginated)",
)
async def list_templates(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    disease_id: Optional[int] = Query(None, description="Filter by disease"),
    include_inactive: bool = Query(False, description="Include inactive templates"),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[FormTemplateResponse]:
    q = select(FormTemplate)
    if not include_inactive:
        q = q.where(FormTemplate.is_active.is_(True))
    if disease_id is not None:
        q = q.where(FormTemplate.disease_id == disease_id)

    # Total count
    count_q = select(func.count()).select_from(q.subquery())
    total: int = (await db.execute(count_q)).scalar_one()

    # Paginated rows ordered by disease, then newest version first
    offset = (page - 1) * page_size
    result = await db.execute(
        q.order_by(FormTemplate.disease_id, FormTemplate.version.desc())
        .offset(offset)
        .limit(page_size)
    )
    templates = result.scalars().all()

    return PaginatedResponse(
        items=templates,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ===========================================================================
# POST /  — create template (version=1, admin only)
# ===========================================================================

@router.post(
    "/",
    response_model=FormTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new form template (admin only)",
)
async def create_template(
    payload: FormTemplateCreate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> FormTemplateResponse:
    # Verify the referenced disease exists
    disease_result = await db.execute(
        select(Disease).where(Disease.id == payload.disease_id)
    )
    if disease_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disease id={payload.disease_id} not found",
        )

    # Build the JSONB schema dict; embed version and disease_id for readability
    schema_dict = payload.schema.model_dump(exclude_none=True)
    schema_dict["version"] = 1
    schema_dict["disease_id"] = payload.disease_id

    template = FormTemplate(
        disease_id=payload.disease_id,
        version=1,
        schema=schema_dict,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()

    await _audit(
        db,
        event_type="template_created",
        actor=current_user,
        entity_id=template.id,
        description=(
            f"Form template v1 created for disease id={payload.disease_id} "
            f"(template id={template.id})"
        ),
    )

    await db.commit()
    await db.refresh(template)
    return template


# ===========================================================================
# GET /{id}  — get single template with full schema
# ===========================================================================

@router.get(
    "/{id}",
    response_model=FormTemplateResponse,
    summary="Get a form template by ID",
)
async def get_template(
    id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FormTemplateResponse:
    result = await db.execute(
        select(FormTemplate).where(FormTemplate.id == id)
    )
    template: Optional[FormTemplate] = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form template not found",
        )
    return template


# ===========================================================================
# PUT /{id}  — replace active template, creates new version (admin only)
# ===========================================================================

@router.put(
    "/{id}",
    response_model=FormTemplateResponse,
    summary="Replace active template — creates a new version (admin only)",
)
async def update_template(
    id: int,
    payload: FormTemplateUpdate,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> FormTemplateResponse:
    # Load the template being replaced
    result = await db.execute(
        select(FormTemplate).where(FormTemplate.id == id)
    )
    old_template: Optional[FormTemplate] = result.scalar_one_or_none()
    if old_template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form template not found",
        )

    disease_id = old_template.disease_id
    new_version = old_template.version + 1

    # Deactivate ALL currently active templates for this disease
    await db.execute(
        update(FormTemplate)
        .where(
            FormTemplate.disease_id == disease_id,
            FormTemplate.is_active.is_(True),
        )
        .values(is_active=False)
    )

    # Build new schema dict
    schema_dict = payload.schema.model_dump(exclude_none=True)
    schema_dict["version"] = new_version
    schema_dict["disease_id"] = disease_id

    new_template = FormTemplate(
        disease_id=disease_id,
        version=new_version,
        schema=schema_dict,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(new_template)
    await db.flush()

    await _audit(
        db,
        event_type="template_updated",
        actor=current_user,
        entity_id=new_template.id,
        description=(
            f"Form template for disease id={disease_id} updated: "
            f"v{old_template.version} (id={old_template.id}) deactivated, "
            f"v{new_version} (id={new_template.id}) created"
        ),
    )

    await db.commit()
    await db.refresh(new_template)
    return new_template


# ===========================================================================
# DELETE /{id}  — soft-delete (admin only)
# ===========================================================================

@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a form template (admin only)",
)
async def delete_template(
    id: int,
    current_user: User = Depends(role_required(["admin", "sys_admin"])),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(FormTemplate).where(FormTemplate.id == id)
    )
    template: Optional[FormTemplate] = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Form template not found",
        )

    template.is_active = False

    await _audit(
        db,
        event_type="template_deleted",
        actor=current_user,
        entity_id=template.id,
        description=(
            f"Form template id={template.id} v{template.version} "
            f"(disease id={template.disease_id}) soft-deleted"
        ),
    )

    await db.commit()

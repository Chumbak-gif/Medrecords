"""Form Templates router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from datetime import datetime

from src.api.v1.dependencies.auth import get_current_user, role_required
from src.api.v1.dependencies.container import (
    get_create_template_use_case,
    get_delete_template_use_case,
    get_get_template_use_case,
    get_list_templates_use_case,
    get_update_template_use_case,
)
from src.api.v1.schemas.common import PaginatedResponse
from src.application.use_cases.templates.create_template import CreateTemplateCommand, CreateTemplateUseCase
from src.application.use_cases.templates.delete_template import DeleteTemplateCommand, DeleteTemplateUseCase
from src.application.use_cases.templates.get_template import (
    GetActiveTemplateForDiseaseQuery,
    GetTemplateQuery,
    GetTemplateUseCase,
)
from src.application.use_cases.templates.list_templates import ListTemplatesQuery, ListTemplatesUseCase
from src.application.use_cases.templates.update_template import UpdateTemplateCommand, UpdateTemplateUseCase
from src.domain.entities.user import UserEntity
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Form Templates"])


# --- Schemas ---

class FormTemplateCreate(BaseModel):
    disease_id: int
    # Exposed as "schema" in JSON; `schema_` avoids clashing with BaseModel.schema().
    schema_: Any = Field(default=None, alias="schema")

    model_config = {"populate_by_name": True}


class FormTemplateUpdate(BaseModel):
    schema_: Any = Field(default=None, alias="schema")

    model_config = {"populate_by_name": True}


class FormTemplateResponse(BaseModel):
    id: int
    disease_id: int
    version: int
    schema_: Any = Field(default=None, alias="schema")
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        # Ensure the response serializes using the "schema" alias, not "schema_".
        "serialize_by_alias": True,
    }


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


def _template_to_response(template) -> FormTemplateResponse:
    return FormTemplateResponse(
        id=template.id,
        disease_id=template.disease_id,
        version=template.version,
        schema_=template.schema,
        is_active=template.is_active,
        created_by=template.created_by,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


# --- Endpoints ---

@router.get("/disease/{disease_id}/active", response_model=FormTemplateResponse, summary="Get the active template for a disease")
async def get_active_template_for_disease(
    disease_id: int,
    _current_user: UserModel = Depends(get_current_user),
    use_case: GetTemplateUseCase = Depends(get_get_template_use_case),
) -> FormTemplateResponse:
    query = GetActiveTemplateForDiseaseQuery(disease_id=disease_id)
    template = await use_case.get_active_for_disease(query)
    return _template_to_response(template)


@router.get("/", response_model=PaginatedResponse[FormTemplateResponse], summary="List form templates (paginated)")
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    disease_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    _current_user: UserModel = Depends(get_current_user),
    use_case: ListTemplatesUseCase = Depends(get_list_templates_use_case),
) -> PaginatedResponse[FormTemplateResponse]:
    query = ListTemplatesQuery(
        page=page,
        page_size=page_size,
        disease_id=disease_id,
        include_inactive=include_inactive,
    )
    result = await use_case.execute(query)
    return PaginatedResponse(
        items=[_template_to_response(t) for t in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
    )


@router.post("/", response_model=FormTemplateResponse, status_code=status.HTTP_201_CREATED, summary="Create a new form template (admin only)")
async def create_template(
    payload: FormTemplateCreate,
    current_user: UserModel = Depends(role_required(["admin", "sys_admin"])),
    use_case: CreateTemplateUseCase = Depends(get_create_template_use_case),
) -> FormTemplateResponse:
    schema_dict = payload.schema_ if isinstance(payload.schema_, dict) else {}
    command = CreateTemplateCommand(
        disease_id=payload.disease_id,
        schema=schema_dict,
        actor=_to_actor(current_user),
    )
    template = await use_case.execute(command)
    return _template_to_response(template)


@router.get("/{id}", response_model=FormTemplateResponse, summary="Get a form template by ID")
async def get_template(
    id: int,
    _current_user: UserModel = Depends(get_current_user),
    use_case: GetTemplateUseCase = Depends(get_get_template_use_case),
) -> FormTemplateResponse:
    query = GetTemplateQuery(template_id=id)
    template = await use_case.execute(query)
    return _template_to_response(template)


@router.put("/{id}", response_model=FormTemplateResponse, summary="Replace active template — creates a new version (admin only)")
async def update_template(
    id: int,
    payload: FormTemplateUpdate,
    current_user: UserModel = Depends(role_required(["admin", "sys_admin"])),
    use_case: UpdateTemplateUseCase = Depends(get_update_template_use_case),
) -> FormTemplateResponse:
    schema_dict = payload.schema_ if isinstance(payload.schema_, dict) else {}
    command = UpdateTemplateCommand(
        template_id=id,
        schema=schema_dict,
        actor=_to_actor(current_user),
    )
    template = await use_case.execute(command)
    return _template_to_response(template)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Soft-delete a form template (admin only)")
async def delete_template(
    id: int,
    current_user: UserModel = Depends(role_required(["admin", "sys_admin"])),
    use_case: DeleteTemplateUseCase = Depends(get_delete_template_use_case),
) -> None:
    command = DeleteTemplateCommand(
        template_id=id,
        actor=_to_actor(current_user),
    )
    await use_case.execute(command)

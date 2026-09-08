"""Config router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import (
    get_get_config_use_case,
    get_update_config_use_case,
)
from src.application.use_cases.config.get_config import GetConfigQuery, GetConfigUseCase
from src.application.use_cases.config.update_config import UpdateConfigCommand, UpdateConfigUseCase
from src.domain.entities.user import UserEntity
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Config"])

_AUTH_ROLES = ["doctor", "admin", "sys_admin", "pharma_viewer"]
_ADMIN_ROLES = ["sys_admin"]


# --- Schemas ---

class ConfigValuePayload(BaseModel):
    value: str


class AppConfigResponse(BaseModel):
    id: int
    config_key: str
    config_value: str

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

@router.get("/", response_model=list[AppConfigResponse], summary="List all app config key-value pairs")
async def list_configs(
    current_user: UserModel = Depends(role_required(_AUTH_ROLES)),
    use_case: GetConfigUseCase = Depends(get_get_config_use_case),
) -> list[AppConfigResponse]:
    query = GetConfigQuery(actor=_to_actor(current_user))
    configs = await use_case.execute(query)
    return [AppConfigResponse.model_validate(c) for c in configs]


@router.patch("/{key}", response_model=AppConfigResponse, summary="Update a config value (sys_admin only)")
async def update_config(
    key: str,
    payload: ConfigValuePayload,
    current_user: UserModel = Depends(role_required(_ADMIN_ROLES)),
    use_case: UpdateConfigUseCase = Depends(get_update_config_use_case),
) -> AppConfigResponse:
    command = UpdateConfigCommand(
        key=key,
        value=payload.value,
        actor=_to_actor(current_user),
    )
    config = await use_case.execute(command)
    return AppConfigResponse.model_validate(config)

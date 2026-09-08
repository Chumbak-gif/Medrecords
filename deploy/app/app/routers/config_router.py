"""
Config router
Prefix:  /api/v1/config  (mounted in main.py)

Access control:
  GET  /        — any authenticated user
  PATCH /{key}  — sys_admin only
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, role_required
from app.models.app_config import AppConfig
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(tags=["Config"])

_AUTH_ROLES = ["doctor", "admin", "sys_admin", "pharma_viewer"]
_ADMIN_ROLES = ["sys_admin"]


class ConfigValuePayload(BaseModel):
    value: str


class AppConfigResponse(BaseModel):
    id: int
    config_key: str
    config_value: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# GET /  — list all config key-value pairs
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[AppConfigResponse],
    summary="List all app config key-value pairs",
)
async def list_configs(
    current_user: User = Depends(role_required(_AUTH_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[AppConfigResponse]:
    result = await db.execute(select(AppConfig).order_by(AppConfig.config_key))
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# PATCH /{key}  — update config value (sys_admin only)
# ---------------------------------------------------------------------------

@router.patch(
    "/{key}",
    response_model=AppConfigResponse,
    summary="Update a config value (sys_admin only)",
)
async def update_config(
    key: str,
    payload: ConfigValuePayload,
    current_user: User = Depends(role_required(_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AppConfigResponse:
    result = await db.execute(
        select(AppConfig).where(AppConfig.config_key == key)
    )
    config: AppConfig | None = result.scalar_one_or_none()

    if config is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' not found",
        )

    old_value = config.config_value
    config.config_value = payload.value
    config.updated_by = current_user.id

    db.add(
        AuditLog(
            event_type="config_updated",
            actor_id=current_user.id,
            actor_username=current_user.username,
            actor_role=current_user.role,
            entity_type="app_config",
            entity_id=config.id,
            description=f"Config '{key}' updated: '{old_value}' → '{payload.value}'",
        )
    )

    return config

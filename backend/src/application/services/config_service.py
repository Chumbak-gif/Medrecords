"""ConfigService — consolidated business logic for application configuration."""

from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.app_config import AppConfigEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.config_repository import IConfigRepository
from src.domain.services.access_control import AccessControlService


class ConfigService:
    """Consolidated service for application config operations."""

    def __init__(
        self,
        config_repo: IConfigRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._config_repo = config_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def get_config(self, *, actor: Optional[UserEntity] = None) -> list[AppConfigEntity]:
        """Retrieve all application configuration key-value pairs."""
        return await self._config_repo.list(offset=0, limit=1000)

    async def update_config(
        self, *, key: str, value: str, actor: UserEntity
    ) -> AppConfigEntity:
        """Update a config value (sys_admin only).

        Raises:
            ValueError: If actor lacks permission or config key not found.
        """
        try:
            self._access_control.assert_can_manage_config(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            config = await self._config_repo.get_by_key(key)
            if config is None:
                raise ValueError(f"Config key '{key}' not found")

            old_value = config.config_value
            config.config_value = value
            config.updated_by = actor.id

            config = await self._config_repo.update(config)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="config_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="app_config",
                    entity_id=config.id,
                    description=f"Config '{key}' updated: '{old_value}' → '{value}'",
                )
            )
            await self._uow.commit()
            return config

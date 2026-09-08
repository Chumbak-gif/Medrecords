"""Update Config use case — update a config value (sys_admin only), audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.app_config import AppConfigEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.config_repository import ConfigRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class UpdateConfigCommand:
    """Input data for updating a config value."""

    key: str = ""
    value: str = ""
    actor: Optional[UserEntity] = None


class UpdateConfigUseCase:
    """Updates an application config value (sys_admin only)."""

    def __init__(
        self,
        config_repo: ConfigRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._config_repo = config_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: UpdateConfigCommand) -> AppConfigEntity:
        """Update a config value.

        Raises:
            ForbiddenError: If the actor is not sys_admin.
            NotFoundError: If the config key does not exist.
        """
        self._access_control.assert_can_manage_config(command.actor)

        async with self._uow:
            config = await self._config_repo.get_by_key(command.key)
            if config is None:
                raise NotFoundError(f"Config key '{command.key}' not found")

            old_value = config.config_value
            config.config_value = command.value
            config.updated_by = command.actor.id

            config = await self._config_repo.update(config)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="config_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="app_config",
                    entity_id=config.id,
                    description=f"Config '{command.key}' updated: '{old_value}' → '{command.value}'",
                )
            )

            await self._uow.commit()
            return config

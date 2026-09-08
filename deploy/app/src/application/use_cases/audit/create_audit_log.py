"""Create Audit Log use case — persist a client-side event."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import AuditLogRepository


@dataclass
class CreateAuditLogCommand:
    """Input data for creating a client-side audit log entry."""

    event_type: str = ""
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    actor: Optional[UserEntity] = None


class CreateAuditLogUseCase:
    """Creates a new audit log entry (any authenticated user)."""

    def __init__(
        self,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: CreateAuditLogCommand) -> AuditLogEntity:
        """Create a new audit log entry."""
        async with self._uow:
            entry = AuditLogEntity(
                event_type=command.event_type,
                actor_id=command.actor.id,
                actor_username=command.actor.username,
                actor_role=command.actor.role,
                entity_type=command.entity_type,
                entity_id=command.entity_id,
                description=command.description,
                ip_address=command.ip_address,
            )
            entry = await self._audit_repo.add(entry)
            await self._uow.commit()
            return entry

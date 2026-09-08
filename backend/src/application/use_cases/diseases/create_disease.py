"""Create Disease use case — uniqueness check, admin-only, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.disease import DiseaseEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class CreateDiseaseCommand:
    """Input data for creating a new disease."""

    name: str = ""
    description: Optional[str] = None
    actor: Optional[UserEntity] = None


class CreateDiseaseUseCase:
    """Creates a new disease with uniqueness check and admin access control."""

    def __init__(
        self,
        disease_repo: DiseaseRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._disease_repo = disease_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: CreateDiseaseCommand) -> DiseaseEntity:
        """Create a new disease.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            ConflictError: If a disease with the same name already exists.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            # Case-insensitive uniqueness check
            existing = await self._disease_repo.get_by_name(command.name)
            if existing is not None:
                raise ConflictError(f"A disease named '{command.name}' already exists")

            disease = DiseaseEntity(
                name=command.name,
                description=command.description,
                created_by=command.actor.id,
            )
            disease = await self._disease_repo.add(disease)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' created",
                )
            )

            await self._uow.commit()
            return disease

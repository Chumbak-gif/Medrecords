"""Update Disease use case — admin-only, uniqueness check, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.disease import DiseaseEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class UpdateDiseaseCommand:
    """Input data for updating a disease."""

    disease_id: int = 0
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    actor: Optional[UserEntity] = None


class UpdateDiseaseUseCase:
    """Updates a disease with uniqueness check and admin access control."""

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

    async def execute(self, command: UpdateDiseaseCommand) -> DiseaseEntity:
        """Update a disease.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the disease does not exist.
            ConflictError: If the new name conflicts with another disease.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            disease = await self._disease_repo.get_by_id(command.disease_id)
            if disease is None:
                raise NotFoundError("Disease not found")

            if command.name is not None and command.name.lower() != disease.name.lower():
                existing = await self._disease_repo.get_by_name(command.name)
                if existing is not None and existing.id != disease.id:
                    raise ConflictError(f"A disease named '{command.name}' already exists")
                disease.name = command.name

            if command.description is not None:
                disease.description = command.description
            if command.is_active is not None:
                disease.is_active = command.is_active

            disease = await self._disease_repo.update(disease)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' updated",
                )
            )

            await self._uow.commit()
            return disease

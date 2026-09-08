"""Restore Disease use case — reactivate a soft-deleted disease, admin-only."""

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
class RestoreDiseaseCommand:
    """Input data for restoring a soft-deleted disease."""

    disease_id: int = 0
    actor: Optional[UserEntity] = None


class RestoreDiseaseUseCase:
    """Restores a soft-deleted disease by setting is_active=True."""

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

    async def execute(self, command: RestoreDiseaseCommand) -> DiseaseEntity:
        """Restore a soft-deleted disease.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the disease does not exist.
            ConflictError: If the disease is already active.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            disease = await self._disease_repo.get_by_id(command.disease_id)
            if disease is None:
                raise NotFoundError("Disease not found")

            if disease.is_active:
                raise ConflictError("Disease is already active")

            disease.is_active = True
            disease = await self._disease_repo.update(disease)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_restored",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' restored",
                )
            )

            await self._uow.commit()
            return disease

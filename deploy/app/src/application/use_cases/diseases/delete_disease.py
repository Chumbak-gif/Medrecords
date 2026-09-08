"""Delete Disease use case — soft-delete with cascade to sub-diseases, admin-only."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class DeleteDiseaseCommand:
    """Input data for soft-deleting a disease."""

    disease_id: int = 0
    actor: Optional[UserEntity] = None


class DeleteDiseaseUseCase:
    """Soft-deletes a disease and cascades deactivation to sub-diseases."""

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

    async def execute(self, command: DeleteDiseaseCommand) -> None:
        """Soft-delete a disease and its sub-diseases.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the disease does not exist.
            ConflictError: If assessments are linked to the disease.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            disease = await self._disease_repo.get_by_id(command.disease_id)
            if disease is None:
                raise NotFoundError("Disease not found")

            # Check for linked assessments
            assessment_count = await self._disease_repo.get_assessment_count(command.disease_id)
            if assessment_count > 0:
                raise ConflictError(
                    f"Cannot delete disease '{disease.name}': {assessment_count} assessment(s) are linked to it"
                )

            # Soft-delete the disease
            disease.is_active = False
            await self._disease_repo.update(disease)

            # Cascade soft-delete to sub-diseases
            sub_diseases = await self._disease_repo.list_sub_diseases(
                command.disease_id, include_inactive=False
            )
            for sub in sub_diseases:
                sub.is_active = False
                await self._disease_repo.update_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="disease_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="disease",
                    entity_id=disease.id,
                    description=f"Disease '{disease.name}' soft-deleted (cascaded to sub-diseases)",
                )
            )

            await self._uow.commit()

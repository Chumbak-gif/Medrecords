"""Delete Sub-Disease use case — soft-delete, admin-only, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class DeleteSubDiseaseCommand:
    """Input data for soft-deleting a sub-disease."""

    disease_id: int = 0
    sub_disease_id: int = 0
    actor: Optional[UserEntity] = None


class DeleteSubDiseaseUseCase:
    """Soft-deletes a sub-disease by setting is_active=False."""

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

    async def execute(self, command: DeleteSubDiseaseCommand) -> None:
        """Soft-delete a sub-disease.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the sub-disease does not exist.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            sub = await self._disease_repo.get_sub_disease(
                command.sub_disease_id, command.disease_id
            )
            if sub is None:
                raise NotFoundError("Sub-disease not found")

            sub.is_active = False
            await self._disease_repo.update_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="sub_disease_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="sub_disease",
                    entity_id=sub.id,
                    description=f"Sub-disease '{sub.name}' (id={sub.id}) soft-deleted",
                )
            )

            await self._uow.commit()

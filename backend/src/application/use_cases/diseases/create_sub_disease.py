"""Create Sub-Disease use case — admin-only, uniqueness check, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.disease import SubDiseaseEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class CreateSubDiseaseCommand:
    """Input data for creating a new sub-disease."""

    disease_id: int = 0
    name: str = ""
    actor: Optional[UserEntity] = None


class CreateSubDiseaseUseCase:
    """Creates a new sub-disease with uniqueness check and admin access control."""

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

    async def execute(self, command: CreateSubDiseaseCommand) -> SubDiseaseEntity:
        """Create a new sub-disease.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the parent disease does not exist.
            ConflictError: If a sub-disease with the same name already exists.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            disease = await self._disease_repo.get_by_id(command.disease_id)
            if disease is None:
                raise NotFoundError("Disease not found")

            existing = await self._disease_repo.get_sub_disease_by_name(
                command.disease_id, command.name
            )
            if existing is not None:
                raise ConflictError(
                    f"Sub-disease '{command.name}' already exists for this disease"
                )

            sub = SubDiseaseEntity(
                disease_id=command.disease_id,
                name=command.name,
            )
            sub = await self._disease_repo.add_sub_disease(sub)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="sub_disease_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="sub_disease",
                    entity_id=sub.id,
                    description=f"Sub-disease '{sub.name}' created under disease '{disease.name}'",
                )
            )

            await self._uow.commit()
            return sub

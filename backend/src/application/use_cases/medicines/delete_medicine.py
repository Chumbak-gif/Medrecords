"""Delete Medicine use case — soft-delete (deactivate) a medicine."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.medicine_repository import MedicineRepository


@dataclass
class DeleteMedicineCommand:
    """Input data for soft-deleting a medicine."""

    medicine_id: int = 0
    actor: Optional[UserEntity] = None


class DeleteMedicineUseCase:
    """Soft-deletes a medicine by deactivating it."""

    def __init__(
        self,
        medicine_repo: MedicineRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: DeleteMedicineCommand) -> None:
        """Soft-delete a medicine.

        Raises:
            NotFoundError: If the medicine does not exist.
        """
        async with self._uow:
            medicine = await self._medicine_repo.get_by_id(command.medicine_id)
            if medicine is None:
                raise NotFoundError("Medicine not found")

            medicine.is_active = False
            await self._medicine_repo.update(medicine)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' soft-deleted",
                )
            )

            await self._uow.commit()

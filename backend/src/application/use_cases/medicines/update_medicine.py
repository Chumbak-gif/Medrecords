"""Update Medicine use case — update fields with uniqueness check."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.medicine_repository import MedicineRepository


@dataclass
class UpdateMedicineCommand:
    """Input data for updating a medicine."""

    medicine_id: int = 0
    name: Optional[str] = None
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None
    actor: Optional[UserEntity] = None


class UpdateMedicineUseCase:
    """Updates a medicine with uniqueness check on name."""

    def __init__(
        self,
        medicine_repo: MedicineRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: UpdateMedicineCommand) -> MedicineEntity:
        """Update a medicine.

        Raises:
            NotFoundError: If the medicine does not exist.
            ConflictError: If a medicine with the new name already exists.
        """
        async with self._uow:
            medicine = await self._medicine_repo.get_by_id(command.medicine_id)
            if medicine is None:
                raise NotFoundError("Medicine not found")

            if command.name is not None and command.name.lower() != medicine.name.lower():
                existing = await self._medicine_repo.get_by_name(command.name)
                if existing is not None and existing.id != medicine.id:
                    raise ConflictError(f"A medicine named '{command.name}' already exists")
                medicine.name = command.name

            if command.brand_name is not None:
                medicine.brand_name = command.brand_name
            if command.generic_name is not None:
                medicine.generic_name = command.generic_name
            if command.strength is not None:
                medicine.strength = command.strength
            if command.form is not None:
                medicine.form = command.form
            if command.manufacturer is not None:
                medicine.manufacturer = command.manufacturer
            if command.category is not None:
                medicine.category = command.category
            if command.unit is not None:
                medicine.unit = command.unit
            if command.is_active is not None:
                medicine.is_active = command.is_active

            medicine = await self._medicine_repo.update(medicine)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' updated",
                )
            )

            await self._uow.commit()
            return medicine

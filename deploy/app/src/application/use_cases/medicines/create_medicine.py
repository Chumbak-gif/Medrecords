"""Create Medicine use case — uniqueness check, admin-only, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.medicine_repository import MedicineRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class CreateMedicineCommand:
    """Input data for creating a new medicine."""

    name: str = ""
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    actor: Optional[UserEntity] = None


class CreateMedicineUseCase:
    """Creates a new medicine with uniqueness check and admin access control."""

    def __init__(
        self,
        medicine_repo: MedicineRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: CreateMedicineCommand) -> MedicineEntity:
        """Create a new medicine.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            ConflictError: If a medicine with the same name already exists.
        """
        self._access_control.assert_can_manage_diseases(command.actor)

        async with self._uow:
            # Case-insensitive uniqueness check
            existing = await self._medicine_repo.get_by_name(command.name)
            if existing is not None:
                raise ConflictError(f"A medicine named '{command.name}' already exists")

            medicine = MedicineEntity(
                name=command.name,
                brand_name=command.brand_name,
                generic_name=command.generic_name,
                strength=command.strength,
                form=command.form,
                manufacturer=command.manufacturer,
                category=command.category,
                unit=command.unit,
            )
            medicine = await self._medicine_repo.add(medicine)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' created",
                )
            )

            await self._uow.commit()
            return medicine

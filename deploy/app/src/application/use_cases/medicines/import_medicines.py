"""Import Medicines use case — bulk import from parsed spreadsheet data."""

from dataclasses import dataclass, field
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.medicine_repository import MedicineRepository


@dataclass
class ImportMedicineEntry:
    """A single parsed medicine row."""

    name: str = ""
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None


@dataclass
class ImportMedicinesCommand:
    """Input data for bulk importing medicines."""

    entries: list[ImportMedicineEntry] = field(default_factory=list)
    actor: Optional[UserEntity] = None


@dataclass
class ImportResult:
    """Result of the bulk import."""

    inserted: int = 0
    updated: int = 0


class ImportMedicinesUseCase:
    """Bulk imports medicines — inserts new ones, updates existing by name."""

    def __init__(
        self,
        medicine_repo: MedicineRepository,
        audit_repo: AuditLogRepository,
        uow: UnitOfWork,
    ) -> None:
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._uow = uow

    async def execute(self, command: ImportMedicinesCommand) -> ImportResult:
        """Execute the bulk import."""
        async with self._uow:
            inserted = 0
            updated = 0

            for entry in command.entries:
                existing = await self._medicine_repo.get_by_name(entry.name)

                if existing is not None:
                    existing.brand_name = entry.brand_name
                    existing.generic_name = entry.generic_name
                    existing.strength = entry.strength
                    existing.form = entry.form
                    existing.manufacturer = entry.manufacturer
                    existing.category = entry.category
                    existing.unit = entry.unit
                    await self._medicine_repo.update(existing)
                    updated += 1
                else:
                    medicine = MedicineEntity(
                        name=entry.name,
                        brand_name=entry.brand_name,
                        generic_name=entry.generic_name,
                        strength=entry.strength,
                        form=entry.form,
                        manufacturer=entry.manufacturer,
                        category=entry.category,
                        unit=entry.unit,
                    )
                    await self._medicine_repo.add(medicine)
                    inserted += 1

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_bulk_import",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="medicine",
                    entity_id=0,
                    description=f"Bulk import: {inserted} inserted, {updated} updated",
                )
            )

            await self._uow.commit()
            return ImportResult(inserted=inserted, updated=updated)

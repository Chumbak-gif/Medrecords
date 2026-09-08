"""MedicineService — consolidated business logic for medicine management."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.medicine_repository import IMedicineRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for medicines."""

    items: list[MedicineEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


@dataclass
class ImportMedicineEntry:
    """A single parsed medicine row for bulk import."""

    name: str = ""
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None


@dataclass
class ImportResult:
    """Result of the bulk import."""

    inserted: int = 0
    updated: int = 0


class MedicineService:
    """Consolidated service for medicine management operations."""

    def __init__(
        self,
        medicine_repo: IMedicineRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._medicine_repo = medicine_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def list_medicines(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str = "",
        include_inactive: bool = False,
    ) -> PaginatedResult:
        """List medicines with pagination and optional search/active filtering."""
        is_active = None if include_inactive else True
        offset = (page - 1) * page_size

        medicines = await self._medicine_repo.list(
            offset=offset, limit=page_size, is_active=is_active, search=search
        )
        total = await self._medicine_repo.count(is_active=is_active, search=search)
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=medicines, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_medicine(self, *, medicine_id: int) -> MedicineEntity:
        """Retrieve a medicine by ID.

        Raises:
            ValueError: If the medicine does not exist.
        """
        medicine = await self._medicine_repo.get_by_id(medicine_id)
        if medicine is None:
            raise ValueError("Medicine not found")
        return medicine

    async def create_medicine(
        self,
        *,
        name: str,
        brand_name: Optional[str] = None,
        generic_name: Optional[str] = None,
        strength: Optional[str] = None,
        form: Optional[str] = None,
        manufacturer: Optional[str] = None,
        category: Optional[str] = None,
        unit: Optional[str] = None,
        actor: UserEntity,
    ) -> MedicineEntity:
        """Create a new medicine (admin/sys_admin only).

        Raises:
            ValueError: If actor lacks permission or name already exists.
        """
        try:
            self._access_control.assert_can_manage_diseases(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            existing = await self._medicine_repo.get_by_name(name)
            if existing is not None:
                raise ValueError(f"A medicine named '{name}' already exists")

            medicine = MedicineEntity(
                name=name,
                brand_name=brand_name,
                generic_name=generic_name,
                strength=strength,
                form=form,
                manufacturer=manufacturer,
                category=category,
                unit=unit,
            )
            medicine = await self._medicine_repo.add(medicine)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' created",
                )
            )
            await self._uow.commit()
            return medicine

    async def update_medicine(
        self,
        *,
        medicine_id: int,
        name: Optional[str] = None,
        brand_name: Optional[str] = None,
        generic_name: Optional[str] = None,
        strength: Optional[str] = None,
        form: Optional[str] = None,
        manufacturer: Optional[str] = None,
        category: Optional[str] = None,
        unit: Optional[str] = None,
        is_active: Optional[bool] = None,
        actor: UserEntity,
    ) -> MedicineEntity:
        """Update a medicine.

        Raises:
            ValueError: If medicine not found or name conflict.
        """
        async with self._uow:
            medicine = await self._medicine_repo.get_by_id(medicine_id)
            if medicine is None:
                raise ValueError("Medicine not found")

            if name is not None and name.lower() != medicine.name.lower():
                existing = await self._medicine_repo.get_by_name(name)
                if existing is not None and existing.id != medicine.id:
                    raise ValueError(f"A medicine named '{name}' already exists")
                medicine.name = name

            if brand_name is not None:
                medicine.brand_name = brand_name
            if generic_name is not None:
                medicine.generic_name = generic_name
            if strength is not None:
                medicine.strength = strength
            if form is not None:
                medicine.form = form
            if manufacturer is not None:
                medicine.manufacturer = manufacturer
            if category is not None:
                medicine.category = category
            if unit is not None:
                medicine.unit = unit
            if is_active is not None:
                medicine.is_active = is_active

            medicine = await self._medicine_repo.update(medicine)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' updated",
                )
            )
            await self._uow.commit()
            return medicine

    async def delete_medicine(self, *, medicine_id: int, actor: UserEntity) -> None:
        """Soft-delete a medicine.

        Raises:
            ValueError: If medicine not found.
        """
        async with self._uow:
            medicine = await self._medicine_repo.get_by_id(medicine_id)
            if medicine is None:
                raise ValueError("Medicine not found")

            medicine.is_active = False
            await self._medicine_repo.update(medicine)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="medicine",
                    entity_id=medicine.id,
                    description=f"Medicine '{medicine.name}' soft-deleted",
                )
            )
            await self._uow.commit()

    async def import_medicines(
        self, *, entries: list[ImportMedicineEntry], actor: UserEntity
    ) -> ImportResult:
        """Bulk import medicines — inserts new ones, updates existing by name."""
        async with self._uow:
            inserted = 0
            updated = 0

            for entry in entries:
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

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="medicine_bulk_import",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="medicine",
                    entity_id=0,
                    description=f"Bulk import: {inserted} inserted, {updated} updated",
                )
            )
            await self._uow.commit()
            return ImportResult(inserted=inserted, updated=updated)

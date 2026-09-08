"""SQLAlchemy implementation of MedicineRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.medicine import MedicineEntity
from src.domain.repositories.medicine_repository import MedicineRepository
from src.infrastructure.persistence.models.medicine_model import MedicineModel


class SqlAlchemyMedicineRepository(MedicineRepository):
    """Concrete medicine repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: MedicineModel) -> MedicineEntity:
        return MedicineEntity(
            id=model.id,
            name=model.name,
            brand_name=model.brand_name,
            generic_name=model.generic_name,
            strength=model.strength,
            form=model.form,
            manufacturer=model.manufacturer,
            category=model.category,
            unit=model.unit,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: MedicineEntity) -> MedicineModel:
        return MedicineModel(
            id=entity.id,
            name=entity.name,
            brand_name=entity.brand_name,
            generic_name=entity.generic_name,
            strength=entity.strength,
            form=entity.form,
            manufacturer=entity.manufacturer,
            category=entity.category,
            unit=entity.unit,
            is_active=entity.is_active,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, medicine_id: int) -> Optional[MedicineEntity]:
        result = await self._session.get(MedicineModel, medicine_id)
        return self._to_entity(result) if result else None

    async def get_by_name(self, name: str) -> Optional[MedicineEntity]:
        stmt = select(MedicineModel).where(MedicineModel.name == name)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
        search: str = "",
    ) -> list[MedicineEntity]:
        stmt = select(MedicineModel)
        if is_active is not None:
            stmt = stmt.where(MedicineModel.is_active == is_active)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    MedicineModel.name.ilike(pattern),
                    MedicineModel.brand_name.ilike(pattern),
                    MedicineModel.generic_name.ilike(pattern),
                )
            )
        stmt = stmt.order_by(MedicineModel.id.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        is_active: Optional[bool] = None,
        search: str = "",
    ) -> int:
        stmt = select(func.count(MedicineModel.id))
        if is_active is not None:
            stmt = stmt.where(MedicineModel.is_active == is_active)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    MedicineModel.name.ilike(pattern),
                    MedicineModel.brand_name.ilike(pattern),
                    MedicineModel.generic_name.ilike(pattern),
                )
            )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, medicine: MedicineEntity) -> MedicineEntity:
        model = self._to_model(medicine)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, medicine: MedicineEntity) -> MedicineEntity:
        model = await self._session.get(MedicineModel, medicine.id)
        if model is None:
            raise ValueError(f"Medicine with id={medicine.id} not found")
        model.name = medicine.name
        model.brand_name = medicine.brand_name
        model.generic_name = medicine.generic_name
        model.strength = medicine.strength
        model.form = medicine.form
        model.manufacturer = medicine.manufacturer
        model.category = medicine.category
        model.unit = medicine.unit
        model.is_active = medicine.is_active
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, medicine_id: int) -> None:
        model = await self._session.get(MedicineModel, medicine_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

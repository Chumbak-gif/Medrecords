"""SQLAlchemy implementation of PrescriptionRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.prescription_row import PrescriptionRowEntity
from src.domain.repositories.prescription_repository import PrescriptionRepository
from src.infrastructure.persistence.models.prescription_row_model import PrescriptionRowModel


class SqlAlchemyPrescriptionRepository(PrescriptionRepository):
    """Concrete prescription repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: PrescriptionRowModel) -> PrescriptionRowEntity:
        return PrescriptionRowEntity(
            id=model.id,
            assessment_id=model.assessment_id,
            medicine_id=model.medicine_id,
            dosage=model.dosage,
            frequency=model.frequency,
            duration=model.duration,
            instructions=model.instructions,
            sort_order=model.sort_order,
        )

    @staticmethod
    def _to_model(entity: PrescriptionRowEntity) -> PrescriptionRowModel:
        return PrescriptionRowModel(
            id=entity.id,
            assessment_id=entity.assessment_id,
            medicine_id=entity.medicine_id,
            dosage=entity.dosage,
            frequency=entity.frequency,
            duration=entity.duration,
            instructions=entity.instructions,
            sort_order=entity.sort_order,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, row_id: int) -> Optional[PrescriptionRowEntity]:
        result = await self._session.get(PrescriptionRowModel, row_id)
        return self._to_entity(result) if result else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        assessment_id: Optional[int] = None,
    ) -> list[PrescriptionRowEntity]:
        stmt = select(PrescriptionRowModel)
        if assessment_id is not None:
            stmt = stmt.where(PrescriptionRowModel.assessment_id == assessment_id)
        stmt = stmt.order_by(PrescriptionRowModel.sort_order).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        assessment_id: Optional[int] = None,
    ) -> int:
        stmt = select(func.count(PrescriptionRowModel.id))
        if assessment_id is not None:
            stmt = stmt.where(PrescriptionRowModel.assessment_id == assessment_id)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, row: PrescriptionRowEntity) -> PrescriptionRowEntity:
        model = self._to_model(row)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, row: PrescriptionRowEntity) -> PrescriptionRowEntity:
        model = await self._session.get(PrescriptionRowModel, row.id)
        if model is None:
            raise ValueError(f"PrescriptionRow with id={row.id} not found")
        model.assessment_id = row.assessment_id
        model.medicine_id = row.medicine_id
        model.dosage = row.dosage
        model.frequency = row.frequency
        model.duration = row.duration
        model.instructions = row.instructions
        model.sort_order = row.sort_order
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, row_id: int) -> None:
        model = await self._session.get(PrescriptionRowModel, row_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    async def delete_by_assessment(self, assessment_id: int) -> None:
        stmt = sa_delete(PrescriptionRowModel).where(
            PrescriptionRowModel.assessment_id == assessment_id
        )
        await self._session.execute(stmt)
        await self._session.flush()

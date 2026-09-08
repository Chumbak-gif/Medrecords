"""SQLAlchemy implementation of DiseaseRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.entities.disease import DiseaseEntity, SubDiseaseEntity
from src.domain.repositories.disease_repository import DiseaseRepository
from src.infrastructure.persistence.models.assessment_model import AssessmentModel
from src.infrastructure.persistence.models.disease_model import DiseaseModel, SubDiseaseModel


class SqlAlchemyDiseaseRepository(DiseaseRepository):
    """Concrete disease repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: DiseaseModel) -> DiseaseEntity:
        return DiseaseEntity(
            id=model.id,
            name=model.name,
            description=model.description,
            is_active=model.is_active,
            created_by=model.created_by,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: DiseaseEntity) -> DiseaseModel:
        return DiseaseModel(
            id=entity.id,
            name=entity.name,
            description=entity.description,
            is_active=entity.is_active,
            created_by=entity.created_by,
        )

    @staticmethod
    def _sub_to_entity(model: SubDiseaseModel) -> SubDiseaseEntity:
        return SubDiseaseEntity(
            id=model.id,
            disease_id=model.disease_id,
            name=model.name,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    # ------------------------------------------------------------------
    # Disease methods
    # ------------------------------------------------------------------

    async def get_by_id(self, disease_id: int) -> Optional[DiseaseEntity]:
        result = await self._session.get(DiseaseModel, disease_id)
        return self._to_entity(result) if result else None

    async def get_by_name(self, name: str) -> Optional[DiseaseEntity]:
        stmt = select(DiseaseModel).where(func.lower(DiseaseModel.name) == name.lower())
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        search: str = "",
        is_active: Optional[bool] = None,
    ) -> list[DiseaseEntity]:
        stmt = select(DiseaseModel)
        if is_active is not None:
            stmt = stmt.where(DiseaseModel.is_active == is_active)
        if search:
            stmt = stmt.where(DiseaseModel.name.ilike(f"%{search}%"))
        stmt = stmt.order_by(DiseaseModel.name).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        search: str = "",
        is_active: Optional[bool] = None,
    ) -> int:
        stmt = select(func.count(DiseaseModel.id))
        if is_active is not None:
            stmt = stmt.where(DiseaseModel.is_active == is_active)
        if search:
            stmt = stmt.where(DiseaseModel.name.ilike(f"%{search}%"))
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, disease: DiseaseEntity) -> DiseaseEntity:
        model = self._to_model(disease)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, disease: DiseaseEntity) -> DiseaseEntity:
        model = await self._session.get(DiseaseModel, disease.id)
        if model is None:
            raise ValueError(f"Disease with id={disease.id} not found")
        model.name = disease.name
        model.description = disease.description
        model.is_active = disease.is_active
        model.created_by = disease.created_by
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, disease_id: int) -> None:
        model = await self._session.get(DiseaseModel, disease_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    async def get_with_sub_diseases(self, disease_id: int) -> Optional[DiseaseEntity]:
        """Return the disease entity. Sub-diseases are fetched separately via list_sub_diseases."""
        stmt = (
            select(DiseaseModel)
            .options(selectinload(DiseaseModel.sub_diseases))
            .where(DiseaseModel.id == disease_id)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_assessment_count(self, disease_id: int) -> int:
        stmt = select(func.count()).select_from(AssessmentModel).where(
            AssessmentModel.disease_id == disease_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    # ------------------------------------------------------------------
    # Sub-disease methods
    # ------------------------------------------------------------------

    async def list_sub_diseases(
        self, disease_id: int, *, include_inactive: bool = False
    ) -> list[SubDiseaseEntity]:
        stmt = select(SubDiseaseModel).where(SubDiseaseModel.disease_id == disease_id)
        if not include_inactive:
            stmt = stmt.where(SubDiseaseModel.is_active.is_(True))
        stmt = stmt.order_by(SubDiseaseModel.name)
        result = await self._session.execute(stmt)
        return [self._sub_to_entity(row) for row in result.scalars().all()]

    async def get_sub_disease(self, sub_id: int, disease_id: int) -> Optional[SubDiseaseEntity]:
        stmt = select(SubDiseaseModel).where(
            SubDiseaseModel.id == sub_id,
            SubDiseaseModel.disease_id == disease_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._sub_to_entity(model) if model else None

    async def get_sub_disease_by_name(self, disease_id: int, name: str) -> Optional[SubDiseaseEntity]:
        stmt = select(SubDiseaseModel).where(
            SubDiseaseModel.disease_id == disease_id,
            func.lower(SubDiseaseModel.name) == name.lower(),
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._sub_to_entity(model) if model else None

    async def add_sub_disease(self, sub: SubDiseaseEntity) -> SubDiseaseEntity:
        model = SubDiseaseModel(
            disease_id=sub.disease_id,
            name=sub.name,
            is_active=sub.is_active,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._sub_to_entity(model)

    async def update_sub_disease(self, sub: SubDiseaseEntity) -> SubDiseaseEntity:
        stmt = select(SubDiseaseModel).where(SubDiseaseModel.id == sub.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"SubDisease with id={sub.id} not found")
        model.name = sub.name
        model.is_active = sub.is_active
        await self._session.flush()
        await self._session.refresh(model)
        return self._sub_to_entity(model)

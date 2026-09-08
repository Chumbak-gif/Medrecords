"""SQLAlchemy implementation of TemplateRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.form_template import FormTemplateEntity
from src.domain.repositories.template_repository import TemplateRepository
from src.infrastructure.persistence.models.form_template_model import FormTemplateModel


class SqlAlchemyTemplateRepository(TemplateRepository):
    """Concrete form template repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: FormTemplateModel) -> FormTemplateEntity:
        return FormTemplateEntity(
            id=model.id,
            disease_id=model.disease_id,
            version=model.version,
            schema=model.schema,
            is_active=model.is_active,
            created_by=model.created_by,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: FormTemplateEntity) -> FormTemplateModel:
        return FormTemplateModel(
            id=entity.id,
            disease_id=entity.disease_id,
            version=entity.version,
            schema=entity.schema,
            is_active=entity.is_active,
            created_by=entity.created_by,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, template_id: int) -> Optional[FormTemplateEntity]:
        result = await self._session.get(FormTemplateModel, template_id)
        return self._to_entity(result) if result else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        disease_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> list[FormTemplateEntity]:
        stmt = select(FormTemplateModel)
        if disease_id is not None:
            stmt = stmt.where(FormTemplateModel.disease_id == disease_id)
        if is_active is not None:
            stmt = stmt.where(FormTemplateModel.is_active == is_active)
        stmt = stmt.order_by(FormTemplateModel.id.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        disease_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        stmt = select(func.count(FormTemplateModel.id))
        if disease_id is not None:
            stmt = stmt.where(FormTemplateModel.disease_id == disease_id)
        if is_active is not None:
            stmt = stmt.where(FormTemplateModel.is_active == is_active)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, template: FormTemplateEntity) -> FormTemplateEntity:
        model = self._to_model(template)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, template: FormTemplateEntity) -> FormTemplateEntity:
        model = await self._session.get(FormTemplateModel, template.id)
        if model is None:
            raise ValueError(f"FormTemplate with id={template.id} not found")
        model.disease_id = template.disease_id
        model.version = template.version
        model.schema = template.schema
        model.is_active = template.is_active
        model.created_by = template.created_by
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, template_id: int) -> None:
        model = await self._session.get(FormTemplateModel, template_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

    async def get_active_for_disease(self, disease_id: int) -> Optional[FormTemplateEntity]:
        stmt = (
            select(FormTemplateModel)
            .where(FormTemplateModel.disease_id == disease_id)
            .where(FormTemplateModel.is_active == True)  # noqa: E712
            .order_by(FormTemplateModel.version.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def deactivate_for_disease(self, disease_id: int) -> None:
        await self._session.execute(
            update(FormTemplateModel)
            .where(FormTemplateModel.disease_id == disease_id)
            .where(FormTemplateModel.is_active == True)  # noqa: E712
            .values(is_active=False)
        )
        await self._session.flush()

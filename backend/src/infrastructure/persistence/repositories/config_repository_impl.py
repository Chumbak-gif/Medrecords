"""SQLAlchemy implementation of ConfigRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.app_config import AppConfigEntity
from src.domain.repositories.config_repository import ConfigRepository
from src.infrastructure.persistence.models.app_config_model import AppConfigModel


class SqlAlchemyConfigRepository(ConfigRepository):
    """Concrete config repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: AppConfigModel) -> AppConfigEntity:
        return AppConfigEntity(
            id=model.id,
            config_key=model.config_key,
            config_value=model.config_value,
            updated_by=model.updated_by,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: AppConfigEntity) -> AppConfigModel:
        return AppConfigModel(
            id=entity.id,
            config_key=entity.config_key,
            config_value=entity.config_value,
            updated_by=entity.updated_by,
        )

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, config_id: int) -> Optional[AppConfigEntity]:
        result = await self._session.get(AppConfigModel, config_id)
        return self._to_entity(result) if result else None

    async def get_by_key(self, config_key: str) -> Optional[AppConfigEntity]:
        stmt = select(AppConfigModel).where(AppConfigModel.config_key == config_key)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[AppConfigEntity]:
        stmt = select(AppConfigModel).order_by(AppConfigModel.id).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(self) -> int:
        stmt = select(func.count(AppConfigModel.id))
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, config: AppConfigEntity) -> AppConfigEntity:
        model = self._to_model(config)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, config: AppConfigEntity) -> AppConfigEntity:
        model = await self._session.get(AppConfigModel, config.id)
        if model is None:
            raise ValueError(f"AppConfig with id={config.id} not found")
        model.config_key = config.config_key
        model.config_value = config.config_value
        model.updated_by = config.updated_by
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, config_id: int) -> None:
        model = await self._session.get(AppConfigModel, config_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

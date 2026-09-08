"""SQLAlchemy implementation of AuditLogRepository."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.audit_log import AuditLogEntity
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.infrastructure.persistence.models.audit_log_model import AuditLogModel


class SqlAlchemyAuditLogRepository(AuditLogRepository):
    """Concrete audit log repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: AuditLogModel) -> AuditLogEntity:
        return AuditLogEntity(
            id=model.id,
            event_type=model.event_type,
            actor_id=model.actor_id,
            actor_username=model.actor_username,
            actor_role=model.actor_role,
            entity_type=model.entity_type,
            entity_id=model.entity_id,
            description=model.description,
            ip_address=model.ip_address,
            created_at=model.created_at,
        )

    @staticmethod
    def _to_model(entity: AuditLogEntity) -> AuditLogModel:
        return AuditLogModel(
            id=entity.id,
            event_type=entity.event_type,
            actor_id=entity.actor_id,
            actor_username=entity.actor_username,
            actor_role=entity.actor_role,
            entity_type=entity.entity_type,
            entity_id=entity.entity_id,
            description=entity.description,
            ip_address=entity.ip_address,
        )

    # ------------------------------------------------------------------
    # Internal filter builder
    # ------------------------------------------------------------------

    def _apply_filters(self, stmt, *, event_type, actor_username, entity_type, from_date, to_date):
        if event_type is not None:
            stmt = stmt.where(AuditLogModel.event_type == event_type)
        if actor_username is not None:
            stmt = stmt.where(AuditLogModel.actor_username.ilike(f"%{actor_username}%"))
        if entity_type is not None:
            stmt = stmt.where(AuditLogModel.entity_type == entity_type)
        if from_date is not None:
            stmt = stmt.where(
                AuditLogModel.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            )
        if to_date is not None:
            stmt = stmt.where(
                AuditLogModel.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            )
        return stmt

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, log_id: int) -> Optional[AuditLogEntity]:
        result = await self._session.get(AuditLogModel, log_id)
        return self._to_entity(result) if result else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        event_type: Optional[str] = None,
        actor_username: Optional[str] = None,
        entity_type: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> list[AuditLogEntity]:
        stmt = select(AuditLogModel)
        stmt = self._apply_filters(
            stmt,
            event_type=event_type,
            actor_username=actor_username,
            entity_type=entity_type,
            from_date=from_date,
            to_date=to_date,
        )
        stmt = stmt.order_by(AuditLogModel.created_at.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        event_type: Optional[str] = None,
        actor_username: Optional[str] = None,
        entity_type: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> int:
        stmt = select(func.count(AuditLogModel.id))
        stmt = self._apply_filters(
            stmt,
            event_type=event_type,
            actor_username=actor_username,
            entity_type=entity_type,
            from_date=from_date,
            to_date=to_date,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, audit_log: AuditLogEntity) -> AuditLogEntity:
        model = self._to_model(audit_log)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, audit_log: AuditLogEntity) -> AuditLogEntity:
        model = await self._session.get(AuditLogModel, audit_log.id)
        if model is None:
            raise ValueError(f"AuditLog with id={audit_log.id} not found")
        model.event_type = audit_log.event_type
        model.actor_id = audit_log.actor_id
        model.actor_username = audit_log.actor_username
        model.actor_role = audit_log.actor_role
        model.entity_type = audit_log.entity_type
        model.entity_id = audit_log.entity_id
        model.description = audit_log.description
        model.ip_address = audit_log.ip_address
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, log_id: int) -> None:
        model = await self._session.get(AuditLogModel, log_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

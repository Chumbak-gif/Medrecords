"""Abstract audit log repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Optional

from src.domain.entities.audit_log import AuditLogEntity


class IAuditLogRepository(ABC):
    """Defines the contract for audit log data access."""

    @abstractmethod
    async def get_by_id(self, log_id: int) -> Optional[AuditLogEntity]:
        """Retrieve an audit log entry by primary key."""
        ...

    @abstractmethod
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
        """Return a paginated list of audit log entries with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        event_type: Optional[str] = None,
        actor_username: Optional[str] = None,
        entity_type: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, audit_log: AuditLogEntity) -> AuditLogEntity:
        """Persist a new audit log entry and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, audit_log: AuditLogEntity) -> AuditLogEntity:
        """Update an existing audit log entry."""
        ...

    @abstractmethod
    async def delete(self, log_id: int) -> None:
        """Delete an audit log entry by primary key."""
        ...


# Backward-compatible alias
AuditLogRepository = IAuditLogRepository

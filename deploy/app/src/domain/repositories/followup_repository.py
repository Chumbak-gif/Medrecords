"""Abstract followup repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import Optional

from src.domain.entities.followup import FollowupEntity


class IFollowupRepository(ABC):
    """Defines the contract for followup data access."""

    @abstractmethod
    async def get_by_id(self, followup_id: int) -> Optional[FollowupEntity]:
        """Retrieve a followup by primary key."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> list[FollowupEntity]:
        """Return a paginated list of followups with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, followup: FollowupEntity) -> FollowupEntity:
        """Persist a new followup and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, followup: FollowupEntity) -> FollowupEntity:
        """Update an existing followup record."""
        ...

    @abstractmethod
    async def delete(self, followup_id: int) -> None:
        """Delete a followup by primary key."""
        ...

    @abstractmethod
    async def get_enriched(self, followup_id: int) -> Optional[dict]:
        """Get a followup with enriched patient/disease data."""
        ...

    @abstractmethod
    async def list_enriched(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        scheduled_from: Optional[date] = None,
        scheduled_to: Optional[date] = None,
    ) -> list[dict]:
        """Return enriched followup data with patient names and disease info."""
        ...


# Backward-compatible alias
FollowupRepository = IFollowupRepository

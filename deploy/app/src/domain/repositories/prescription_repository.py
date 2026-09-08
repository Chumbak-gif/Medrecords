"""Abstract prescription repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.prescription_row import PrescriptionRowEntity


class IPrescriptionRepository(ABC):
    """Defines the contract for prescription row data access."""

    @abstractmethod
    async def get_by_id(self, row_id: int) -> Optional[PrescriptionRowEntity]:
        """Retrieve a prescription row by primary key."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        assessment_id: Optional[int] = None,
    ) -> list[PrescriptionRowEntity]:
        """Return a paginated list of prescription rows, optionally for an assessment."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        assessment_id: Optional[int] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, row: PrescriptionRowEntity) -> PrescriptionRowEntity:
        """Persist a new prescription row and return it with generated fields."""
        ...

    @abstractmethod
    async def update(self, row: PrescriptionRowEntity) -> PrescriptionRowEntity:
        """Update an existing prescription row."""
        ...

    @abstractmethod
    async def delete(self, row_id: int) -> None:
        """Delete a prescription row by primary key."""
        ...

    @abstractmethod
    async def delete_by_assessment(self, assessment_id: int) -> None:
        """Delete all prescription rows for a given assessment."""
        ...


# Backward-compatible alias
PrescriptionRepository = IPrescriptionRepository

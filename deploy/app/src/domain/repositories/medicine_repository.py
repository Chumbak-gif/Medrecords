"""Abstract medicine repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.medicine import MedicineEntity


class IMedicineRepository(ABC):
    """Defines the contract for medicine data access."""

    @abstractmethod
    async def get_by_id(self, medicine_id: int) -> Optional[MedicineEntity]:
        """Retrieve a medicine by primary key."""
        ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[MedicineEntity]:
        """Retrieve a medicine by unique name."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
        search: str = "",
    ) -> list[MedicineEntity]:
        """Return a paginated list of medicines with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        is_active: Optional[bool] = None,
        search: str = "",
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, medicine: MedicineEntity) -> MedicineEntity:
        """Persist a new medicine and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, medicine: MedicineEntity) -> MedicineEntity:
        """Update an existing medicine record."""
        ...

    @abstractmethod
    async def delete(self, medicine_id: int) -> None:
        """Delete a medicine by primary key."""
        ...


# Backward-compatible alias
MedicineRepository = IMedicineRepository

"""Abstract disease repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.disease import DiseaseEntity, SubDiseaseEntity


class IDiseaseRepository(ABC):
    """Defines the contract for disease data access."""

    @abstractmethod
    async def get_by_id(self, disease_id: int) -> Optional[DiseaseEntity]:
        """Retrieve a disease by primary key."""
        ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[DiseaseEntity]:
        """Retrieve a disease by unique name (case-insensitive)."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        search: str = "",
        is_active: Optional[bool] = None,
    ) -> list[DiseaseEntity]:
        """Return a paginated list of diseases with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        search: str = "",
        is_active: Optional[bool] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, disease: DiseaseEntity) -> DiseaseEntity:
        """Persist a new disease and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, disease: DiseaseEntity) -> DiseaseEntity:
        """Update an existing disease record."""
        ...

    @abstractmethod
    async def delete(self, disease_id: int) -> None:
        """Delete a disease by primary key."""
        ...

    @abstractmethod
    async def get_with_sub_diseases(self, disease_id: int) -> Optional[DiseaseEntity]:
        """Retrieve a disease by ID along with its sub-diseases."""
        ...

    @abstractmethod
    async def get_assessment_count(self, disease_id: int) -> int:
        """Return the number of assessments linked to a disease."""
        ...

    # ── Sub-disease methods ──────────────────────────────────────────────────

    @abstractmethod
    async def list_sub_diseases(
        self, disease_id: int, *, include_inactive: bool = False
    ) -> list[SubDiseaseEntity]:
        """Return sub-diseases for a given disease."""
        ...

    @abstractmethod
    async def get_sub_disease(self, sub_id: int, disease_id: int) -> Optional[SubDiseaseEntity]:
        """Retrieve a specific sub-disease by ID scoped to its parent disease."""
        ...

    @abstractmethod
    async def get_sub_disease_by_name(self, disease_id: int, name: str) -> Optional[SubDiseaseEntity]:
        """Retrieve a sub-disease by name within a disease (case-insensitive)."""
        ...

    @abstractmethod
    async def add_sub_disease(self, sub: SubDiseaseEntity) -> SubDiseaseEntity:
        """Persist a new sub-disease and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update_sub_disease(self, sub: SubDiseaseEntity) -> SubDiseaseEntity:
        """Update an existing sub-disease record."""
        ...


# Backward-compatible alias
DiseaseRepository = IDiseaseRepository

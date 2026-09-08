"""Abstract patient repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.patient import PatientEntity


class IPatientRepository(ABC):
    """Defines the contract for patient data access."""

    @abstractmethod
    async def get_by_id(self, patient_id: int) -> Optional[PatientEntity]:
        """Retrieve a patient by primary key."""
        ...

    @abstractmethod
    async def get_by_contact_number(self, contact_number: str) -> Optional[PatientEntity]:
        """Retrieve a patient by unique contact number."""
        ...

    @abstractmethod
    async def get_by_uid(self, patient_uid: str) -> Optional[PatientEntity]:
        """Retrieve a patient by their PAT-XXXXXX UID."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        doctor_id: Optional[int] = None,
        search: str = "",
    ) -> list[PatientEntity]:
        """Return a paginated list of patients, optionally scoped to a doctor."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        doctor_id: Optional[int] = None,
        search: str = "",
    ) -> int:
        """Return total count of patients matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, patient: PatientEntity) -> PatientEntity:
        """Persist a new patient and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, patient: PatientEntity) -> PatientEntity:
        """Update an existing patient record."""
        ...

    @abstractmethod
    async def delete(self, patient_id: int) -> None:
        """Delete a patient by primary key."""
        ...


# Backward-compatible alias
PatientRepository = IPatientRepository

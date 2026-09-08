"""Abstract assessment repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from src.domain.entities.assessment import AssessmentEntity


class IAssessmentRepository(ABC):
    """Defines the contract for assessment data access."""

    @abstractmethod
    async def get_by_id(self, assessment_id: int) -> Optional[AssessmentEntity]:
        """Retrieve an assessment by primary key."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        patient_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> list[AssessmentEntity]:
        """Return a paginated list of assessments with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        patient_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, assessment: AssessmentEntity) -> AssessmentEntity:
        """Persist a new assessment and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, assessment: AssessmentEntity) -> AssessmentEntity:
        """Update an existing assessment record."""
        ...

    @abstractmethod
    async def delete(self, assessment_id: int) -> None:
        """Delete an assessment by primary key."""
        ...

    @abstractmethod
    async def list_expired_for_locking(self, now: datetime) -> list[AssessmentEntity]:
        """Return submitted assessments whose lock window has expired."""
        ...

    @abstractmethod
    async def count_since(self, since: datetime) -> int:
        """Return count of assessments created since the given datetime."""
        ...

    @abstractmethod
    async def get_monthly_volume(self, since: datetime) -> list[tuple[int, int, int]]:
        """Return (year, month, count) tuples for assessments since given datetime."""
        ...

    @abstractmethod
    async def get_by_disease_distribution(
        self,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> list[tuple[str, int]]:
        """Return (disease_name, count) tuples for assessment distribution."""
        ...

    @abstractmethod
    async def get_daily_trend(
        self,
        start: datetime,
        end: datetime,
    ) -> list[tuple[int, int, int, int]]:
        """Return (year, month, day, count) tuples for daily assessment trend."""
        ...

    @abstractmethod
    async def get_disease_summary(
        self,
        month_start: datetime,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        disease_id: Optional[int] = None,
    ) -> list[tuple[str, int, int, int, int]]:
        """Return (disease_name, total, this_month, submitted, locked) tuples."""
        ...

    @abstractmethod
    async def export_assessments_with_details(
        self,
        doctor_id: Optional[int] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
    ) -> list[dict]:
        """Return assessment export data with patient and disease details joined."""
        ...

    @abstractmethod
    async def get_assessment_pdf_data(self, assessment_id: int) -> Optional[dict]:
        """Return full assessment data with patient, disease, and prescriptions for PDF."""
        ...


# Backward-compatible alias
AssessmentRepository = IAssessmentRepository

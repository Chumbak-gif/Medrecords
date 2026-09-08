"""AnalyticsService — consolidated business logic for analytics."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.disease_repository import IDiseaseRepository
from src.domain.repositories.patient_repository import IPatientRepository
from src.domain.repositories.user_repository import IUserRepository


@dataclass
class KpisResult:
    """Admin dashboard KPIs."""

    total_assessments: int = 0
    this_month_assessments: int = 0
    active_patients: int = 0
    active_doctors: int = 0
    active_diseases: int = 0


@dataclass
class MonthlyVolumeItem:
    """Single month volume."""

    month: str = ""
    count: int = 0


@dataclass
class DiseaseDistributionItem:
    """Single disease count."""

    disease_name: str = ""
    count: int = 0


@dataclass
class TrendItem:
    """Single day trend."""

    date: str = ""
    count: int = 0


@dataclass
class DiseaseSummaryRow:
    """Per-disease summary row."""

    disease_name: str = ""
    total_count: int = 0
    this_month_count: int = 0
    submitted_count: int = 0
    locked_count: int = 0


class AnalyticsService:
    """Consolidated service for analytics operations."""

    def __init__(
        self,
        assessment_repo: IAssessmentRepository,
        patient_repo: IPatientRepository,
        user_repo: IUserRepository,
        disease_repo: IDiseaseRepository,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._patient_repo = patient_repo
        self._user_repo = user_repo
        self._disease_repo = disease_repo

    async def get_kpis(self, *, actor: Optional[UserEntity] = None) -> KpisResult:
        """Retrieve admin dashboard KPIs."""
        now = datetime.now(tz=timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_assessments = await self._assessment_repo.count()
        this_month_assessments = await self._assessment_repo.count_since(month_start)
        active_patients = await self._patient_repo.count()
        active_doctors = await self._user_repo.count(role="doctor", is_active=True)
        active_diseases = await self._disease_repo.count(is_active=True)

        return KpisResult(
            total_assessments=total_assessments,
            this_month_assessments=this_month_assessments,
            active_patients=active_patients,
            active_doctors=active_doctors,
            active_diseases=active_diseases,
        )

    async def get_monthly_volume(
        self, *, actor: Optional[UserEntity] = None
    ) -> list[MonthlyVolumeItem]:
        """Retrieve monthly assessment volume for trailing 12 months."""
        now = datetime.now(tz=timezone.utc)
        twelve_months_ago = (now.replace(day=1) - timedelta(days=365)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        rows = await self._assessment_repo.get_monthly_volume(twelve_months_ago)
        return [
            MonthlyVolumeItem(month=f"{yr:04d}-{mo:02d}", count=cnt) for yr, mo, cnt in rows
        ]

    async def get_by_disease(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        actor: Optional[UserEntity] = None,
    ) -> list[DiseaseDistributionItem]:
        """Retrieve assessment count per disease."""
        from_dt = (
            datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            if from_date
            else None
        )
        to_dt = (
            datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if to_date
            else None
        )
        rows = await self._assessment_repo.get_by_disease_distribution(from_date=from_dt, to_date=to_dt)
        return [DiseaseDistributionItem(disease_name=name, count=cnt) for name, cnt in rows]

    async def get_trend(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        actor: Optional[UserEntity] = None,
    ) -> list[TrendItem]:
        """Retrieve daily assessment trend."""
        now = datetime.now(tz=timezone.utc)
        start = (
            datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            if from_date
            else (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        end = (
            datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if to_date
            else now
        )
        rows = await self._assessment_repo.get_daily_trend(start, end)
        return [TrendItem(date=f"{yr:04d}-{mo:02d}-{dy:02d}", count=cnt) for yr, mo, dy, cnt in rows]

    async def get_disease_summary(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        disease_id: Optional[int] = None,
        actor: Optional[UserEntity] = None,
    ) -> list[DiseaseSummaryRow]:
        """Retrieve per-disease statistical summary."""
        now = datetime.now(tz=timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        from_dt = (
            datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            if from_date
            else None
        )
        to_dt = (
            datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if to_date
            else None
        )
        rows = await self._assessment_repo.get_disease_summary(
            month_start=month_start, from_date=from_dt, to_date=to_dt, disease_id=disease_id
        )
        return [
            DiseaseSummaryRow(
                disease_name=name,
                total_count=total,
                this_month_count=this_month,
                submitted_count=submitted,
                locked_count=locked,
            )
            for name, total, this_month, submitted, locked in rows
        ]

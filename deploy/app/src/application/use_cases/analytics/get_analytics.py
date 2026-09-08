"""Analytics use cases — admin KPIs, monthly volume, disease distribution, trends."""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.disease_repository import DiseaseRepository
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.repositories.user_repository import UserRepository


@dataclass
class GetKpisQuery:
    """Input for retrieving analytics KPIs."""

    actor: Optional[UserEntity] = None


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
class GetMonthlyVolumeQuery:
    """Input for monthly volume retrieval."""

    actor: Optional[UserEntity] = None


@dataclass
class DiseaseDistributionItem:
    """Single disease count."""

    disease_name: str = ""
    count: int = 0


@dataclass
class GetByDiseaseQuery:
    """Input for disease distribution."""

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    actor: Optional[UserEntity] = None


@dataclass
class TrendItem:
    """Single day trend."""

    date: str = ""
    count: int = 0


@dataclass
class GetTrendQuery:
    """Input for trend retrieval."""

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    actor: Optional[UserEntity] = None


@dataclass
class DiseaseSummaryRow:
    """Per-disease summary row."""

    disease_name: str = ""
    total_count: int = 0
    this_month_count: int = 0
    submitted_count: int = 0
    locked_count: int = 0


@dataclass
class GetDiseaseSummaryQuery:
    """Input for disease summary."""

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    disease_id: Optional[int] = None
    actor: Optional[UserEntity] = None


class GetAnalyticsUseCase:
    """Handles all analytics operations."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        patient_repo: PatientRepository,
        user_repo: UserRepository,
        disease_repo: DiseaseRepository,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._patient_repo = patient_repo
        self._user_repo = user_repo
        self._disease_repo = disease_repo

    async def get_kpis(self, query: GetKpisQuery) -> KpisResult:
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

    async def get_monthly_volume(self, query: GetMonthlyVolumeQuery) -> list[MonthlyVolumeItem]:
        """Retrieve monthly assessment volume for trailing 12 months."""
        now = datetime.now(tz=timezone.utc)
        twelve_months_ago = (now.replace(day=1) - timedelta(days=365)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        rows = await self._assessment_repo.get_monthly_volume(twelve_months_ago)
        return [
            MonthlyVolumeItem(month=f"{yr:04d}-{mo:02d}", count=cnt)
            for yr, mo, cnt in rows
        ]

    async def get_by_disease(self, query: GetByDiseaseQuery) -> list[DiseaseDistributionItem]:
        """Retrieve assessment count per disease."""
        from_dt = (
            datetime(query.from_date.year, query.from_date.month, query.from_date.day, tzinfo=timezone.utc)
            if query.from_date else None
        )
        to_dt = (
            datetime(query.to_date.year, query.to_date.month, query.to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if query.to_date else None
        )
        rows = await self._assessment_repo.get_by_disease_distribution(from_date=from_dt, to_date=to_dt)
        return [
            DiseaseDistributionItem(disease_name=name, count=cnt)
            for name, cnt in rows
        ]

    async def get_trend(self, query: GetTrendQuery) -> list[TrendItem]:
        """Retrieve daily assessment trend."""
        now = datetime.now(tz=timezone.utc)
        start = (
            datetime(query.from_date.year, query.from_date.month, query.from_date.day, tzinfo=timezone.utc)
            if query.from_date
            else (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        end = (
            datetime(query.to_date.year, query.to_date.month, query.to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if query.to_date
            else now
        )
        rows = await self._assessment_repo.get_daily_trend(start, end)
        return [
            TrendItem(date=f"{yr:04d}-{mo:02d}-{dy:02d}", count=cnt)
            for yr, mo, dy, cnt in rows
        ]

    async def get_disease_summary(self, query: GetDiseaseSummaryQuery) -> list[DiseaseSummaryRow]:
        """Retrieve per-disease statistical summary."""
        now = datetime.now(tz=timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        from_dt = (
            datetime(query.from_date.year, query.from_date.month, query.from_date.day, tzinfo=timezone.utc)
            if query.from_date else None
        )
        to_dt = (
            datetime(query.to_date.year, query.to_date.month, query.to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if query.to_date else None
        )
        rows = await self._assessment_repo.get_disease_summary(
            month_start=month_start,
            from_date=from_dt,
            to_date=to_dt,
            disease_id=query.disease_id,
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

"""Analytics use cases — admin KPIs, monthly volume, disease distribution, trends."""

from dataclasses import dataclass
from dataclasses import field as dataclasses_field
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

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
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

    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
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
    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
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
    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
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
    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
    actor: Optional[UserEntity] = None


@dataclass
class NumericStatRow:
    """Numeric field summary (mean / median / range)."""

    title: str = ""
    mean: float = 0.0
    median: float = 0.0
    range_min: float = 0.0
    range_max: float = 0.0


@dataclass
class CategoryCount:
    """Single category label + count."""

    label: str = ""
    count: int = 0


@dataclass
class CategoricalStatRow:
    """Categorical field distribution."""

    field: str = ""
    categories: list[CategoryCount] = dataclasses_field(default_factory=list)


@dataclass
class PatientStatisticsResult:
    """Numeric + categorical statistics across assessment form data."""

    numeric_stats: list[NumericStatRow] = dataclasses_field(default_factory=list)
    categorical_stats: list[CategoricalStatRow] = dataclasses_field(default_factory=list)


@dataclass
class GetPatientStatisticsQuery:
    """Input for patient statistics."""

    disease_id: Optional[int] = None
    disease_ids: Optional[list[int]] = None
    doctor_ids: Optional[list[int]] = None
    age_group: Optional[str] = None
    gender: Optional[str] = None
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

    @staticmethod
    def _doctor_scope(actor: Optional[UserEntity]) -> Optional[int]:
        """Return the actor's id if they are a doctor (scoping their own data), else None."""
        if actor is not None and actor.role == "doctor":
            return actor.id
        return None

    async def get_kpis(self, query: GetKpisQuery) -> KpisResult:
        """Retrieve dashboard KPIs — scoped to the doctor's own data when actor
        is a doctor, and further filtered by date range / disease / doctor /
        age group / gender when provided."""
        now = datetime.now(tz=timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        doctor_id = self._doctor_scope(query.actor)

        from_dt = (
            datetime(query.from_date.year, query.from_date.month, query.from_date.day, tzinfo=timezone.utc)
            if query.from_date else None
        )
        to_dt = (
            datetime(query.to_date.year, query.to_date.month, query.to_date.day, 23, 59, 59, tzinfo=timezone.utc)
            if query.to_date else None
        )
        has_extra_filters = bool(
            query.from_date or query.to_date or query.disease_ids or query.doctor_ids
            or query.age_group or query.gender
        )

        if doctor_id is not None:
            # Doctor view: always scoped to their own assessments, further
            # narrowed by any additional filters they've applied.
            total_assessments = await self._assessment_repo.count_filtered(
                doctor_id=doctor_id, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=from_dt, to_date=to_dt,
            )
            this_month_assessments = await self._assessment_repo.count_filtered(
                doctor_id=doctor_id, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=max(from_dt, month_start) if from_dt else month_start, to_date=to_dt,
            )
            active_patients = await self._assessment_repo.count_distinct_patients_filtered(
                doctor_id=doctor_id, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=from_dt, to_date=to_dt,
            )
            active_doctors = 1
            active_diseases = await self._disease_repo.count(is_active=True)
        elif has_extra_filters:
            total_assessments = await self._assessment_repo.count_filtered(
                doctor_ids=query.doctor_ids, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=from_dt, to_date=to_dt,
            )
            this_month_assessments = await self._assessment_repo.count_filtered(
                doctor_ids=query.doctor_ids, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=max(from_dt, month_start) if from_dt else month_start, to_date=to_dt,
            )
            active_patients = await self._assessment_repo.count_distinct_patients_filtered(
                doctor_ids=query.doctor_ids, disease_ids=query.disease_ids,
                age_group=query.age_group, gender=query.gender,
                from_date=from_dt, to_date=to_dt,
            )
            active_doctors = await self._user_repo.count(role="doctor", is_active=True)
            active_diseases = await self._disease_repo.count(is_active=True)
        else:
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
        """Retrieve monthly assessment volume for trailing 12 months, optionally
        filtered by disease / doctor / age group / gender."""
        now = datetime.now(tz=timezone.utc)
        twelve_months_ago = (now.replace(day=1) - timedelta(days=365)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        doctor_id = self._doctor_scope(query.actor)
        rows = await self._assessment_repo.get_monthly_volume(
            twelve_months_ago,
            doctor_id=doctor_id,
            doctor_ids=query.doctor_ids,
            disease_ids=query.disease_ids,
            age_group=query.age_group,
            gender=query.gender,
        )
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
        doctor_id = self._doctor_scope(query.actor)
        rows = await self._assessment_repo.get_by_disease_distribution(
            from_date=from_dt,
            to_date=to_dt,
            doctor_id=doctor_id,
            doctor_ids=query.doctor_ids,
            disease_ids=query.disease_ids,
            age_group=query.age_group,
            gender=query.gender,
        )
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
        doctor_id = self._doctor_scope(query.actor)
        rows = await self._assessment_repo.get_daily_trend(
            start,
            end,
            doctor_id=doctor_id,
            doctor_ids=query.doctor_ids,
            disease_ids=query.disease_ids,
            age_group=query.age_group,
            gender=query.gender,
        )
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
        doctor_id = self._doctor_scope(query.actor)
        rows = await self._assessment_repo.get_disease_summary(
            month_start=month_start,
            from_date=from_dt,
            to_date=to_dt,
            disease_id=query.disease_id,
            doctor_id=doctor_id,
            doctor_ids=query.doctor_ids,
            disease_ids=query.disease_ids,
            age_group=query.age_group,
            gender=query.gender,
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

    async def get_patient_statistics(self, query: GetPatientStatisticsQuery) -> PatientStatisticsResult:
        """Compute numeric + categorical statistics from assessment form data.

        Numeric fields: mean, median, range. Categorical/text fields: category
        counts. Also computes Age statistics from linked patients. Scoped to
        the doctor's own assessments when the actor is a doctor.
        """
        import statistics as stats_mod
        from collections import Counter, defaultdict
        from datetime import date as date_cls

        doctor_id = self._doctor_scope(query.actor)
        rows = await self._assessment_repo.get_statistics_rows(
            disease_id=query.disease_id,
            doctor_id=doctor_id,
            doctor_ids=query.doctor_ids,
            disease_ids=query.disease_ids,
            age_group=query.age_group,
            gender=query.gender,
        )

        if not rows:
            return PatientStatisticsResult(numeric_stats=[], categorical_stats=[])

        today = date_cls.today()
        ages: list[float] = []
        numeric_fields: dict[str, list[float]] = defaultdict(list)
        categorical_fields: dict[str, list[str]] = defaultdict(list)

        for form_data, dob in rows:
            if dob:
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                ages.append(float(age))

            if not isinstance(form_data, dict):
                continue
            for key, value in form_data.items():
                if value is None or value == "":
                    continue
                try:
                    numeric_fields[key].append(float(value))
                except (ValueError, TypeError):
                    categorical_fields[key].append(str(value))

        numeric_stats: list[NumericStatRow] = []

        if ages:
            numeric_stats.append(
                NumericStatRow(
                    title="Age",
                    mean=round(stats_mod.mean(ages), 1),
                    median=round(stats_mod.median(ages), 1),
                    range_min=min(ages),
                    range_max=max(ages),
                )
            )

        for field_name, values in sorted(numeric_fields.items()):
            if not values:
                continue
            numeric_stats.append(
                NumericStatRow(
                    title=field_name.replace("_", " ").title(),
                    mean=round(stats_mod.mean(values), 1),
                    median=round(stats_mod.median(values), 1),
                    range_min=min(values),
                    range_max=max(values),
                )
            )

        categorical_stats: list[CategoricalStatRow] = []
        for field_name, values in sorted(categorical_fields.items()):
            counter = Counter(values)
            categories = [
                CategoryCount(label=label, count=count)
                for label, count in counter.most_common(20)
            ]
            if categories:
                categorical_stats.append(CategoricalStatRow(field=field_name, categories=categories))

        return PatientStatisticsResult(numeric_stats=numeric_stats, categorical_stats=categorical_stats)

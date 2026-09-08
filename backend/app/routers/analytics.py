"""
Analytics router
Prefix:  /api/v1/analytics  (mounted in main.py)

Access control:  admin, sys_admin for all endpoints
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Integer, cast, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import role_required
from app.models.assessment import Assessment
from app.models.disease import Disease
from app.models.patient import Patient
from app.models.user import User
from app.schemas.analytics import (
    AdminKpis,
    CategoryCount,
    CategoricalStatRow,
    DiseaseDistributionItem,
    DiseaseSummaryRow,
    MonthlyVolumeItem,
    NumericStatRow,
    PatientStatistics,
    TrendItem,
)

router = APIRouter(tags=["Analytics"])

_ADMIN_ROLES = ["admin", "sys_admin"]
_ANALYTICS_ROLES = ["admin", "sys_admin", "pharma_viewer"]


# ---------------------------------------------------------------------------
# GET /kpis
# ---------------------------------------------------------------------------

@router.get(
    "/kpis",
    response_model=AdminKpis,
    summary="Admin dashboard KPI cards",
)
async def get_admin_kpis(
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> AdminKpis:
    now = datetime.now(tz=timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_assessments: int = (
        await db.execute(select(func.count()).select_from(Assessment))
    ).scalar_one()

    this_month_assessments: int = (
        await db.execute(
            select(func.count())
            .select_from(Assessment)
            .where(Assessment.created_at >= month_start)
        )
    ).scalar_one()

    active_patients: int = (
        await db.execute(
            select(func.count()).select_from(Patient).where(Patient.is_active.is_(True))
        )
    ).scalar_one()

    active_doctors: int = (
        await db.execute(
            select(func.count())
            .select_from(User)
            .where(User.role == "doctor", User.is_active.is_(True))
        )
    ).scalar_one()

    active_diseases: int = (
        await db.execute(
            select(func.count())
            .select_from(Disease)
            .where(Disease.is_active.is_(True))
        )
    ).scalar_one()

    return AdminKpis(
        total_assessments=total_assessments,
        this_month_assessments=this_month_assessments,
        active_patients=active_patients,
        active_doctors=active_doctors,
        active_diseases=active_diseases,
    )


# ---------------------------------------------------------------------------
# GET /monthly-volume
# ---------------------------------------------------------------------------

@router.get(
    "/monthly-volume",
    response_model=list[MonthlyVolumeItem],
    summary="Monthly assessment count for trailing 12 months",
)
async def get_monthly_volume(
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[MonthlyVolumeItem]:
    now = datetime.now(tz=timezone.utc)
    twelve_months_ago = (now.replace(day=1) - timedelta(days=365)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    year_col = cast(extract("year", Assessment.created_at), Integer)
    month_col = cast(extract("month", Assessment.created_at), Integer)

    result = await db.execute(
        select(year_col.label("yr"), month_col.label("mo"), func.count().label("cnt"))
        .where(Assessment.created_at >= twelve_months_ago)
        .group_by(year_col, month_col)
        .order_by(year_col, month_col)
    )
    rows = result.all()
    return [
        MonthlyVolumeItem(month=f"{row.yr:04d}-{row.mo:02d}", count=row.cnt)
        for row in rows
    ]


# ---------------------------------------------------------------------------
# GET /by-disease
# ---------------------------------------------------------------------------

@router.get(
    "/by-disease",
    response_model=list[DiseaseDistributionItem],
    summary="Assessment count per disease",
)
async def get_by_disease(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[DiseaseDistributionItem]:
    q = (
        select(Disease.name.label("disease_name"), func.count(Assessment.id).label("cnt"))
        .join(Assessment, Assessment.disease_id == Disease.id)
        .group_by(Disease.name)
        .order_by(func.count(Assessment.id).desc())
    )
    if from_date is not None:
        q = q.where(Assessment.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc))
    if to_date is not None:
        q = q.where(Assessment.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc))
    result = await db.execute(q)
    return [DiseaseDistributionItem(disease_name=r.disease_name, count=r.cnt) for r in result.all()]


# ---------------------------------------------------------------------------
# GET /trend
# ---------------------------------------------------------------------------

@router.get(
    "/trend",
    response_model=list[TrendItem],
    summary="Assessment count per day over date range",
)
async def get_trend(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[TrendItem]:
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

    year_col = cast(extract("year", Assessment.created_at), Integer)
    month_col = cast(extract("month", Assessment.created_at), Integer)
    day_col = cast(extract("day", Assessment.created_at), Integer)

    result = await db.execute(
        select(
            year_col.label("yr"),
            month_col.label("mo"),
            day_col.label("dy"),
            func.count().label("cnt"),
        )
        .where(Assessment.created_at >= start, Assessment.created_at <= end)
        .group_by(year_col, month_col, day_col)
        .order_by(year_col, month_col, day_col)
    )
    return [
        TrendItem(date=f"{r.yr:04d}-{r.mo:02d}-{r.dy:02d}", count=r.cnt)
        for r in result.all()
    ]


# ---------------------------------------------------------------------------
# GET /disease-summary
# ---------------------------------------------------------------------------

@router.get(
    "/disease-summary",
    response_model=list[DiseaseSummaryRow],
    summary="Per-disease statistical summary table",
)
async def get_disease_summary(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    disease_id: Optional[int] = Query(None),
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> list[DiseaseSummaryRow]:
    now = datetime.now(tz=timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base_filters = []
    if from_date is not None:
        base_filters.append(
            Assessment.created_at >= datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        )
    if to_date is not None:
        base_filters.append(
            Assessment.created_at <= datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        )
    if disease_id is not None:
        base_filters.append(Assessment.disease_id == disease_id)

    q = (
        select(
            Disease.name.label("disease_name"),
            func.count(Assessment.id).label("total_count"),
            func.sum(cast(Assessment.created_at >= month_start, Integer)).label("this_month_count"),
            func.sum(cast(Assessment.status == "submitted", Integer)).label("submitted_count"),
            func.sum(cast(Assessment.status == "locked", Integer)).label("locked_count"),
        )
        .join(Assessment, Assessment.disease_id == Disease.id)
        .group_by(Disease.id, Disease.name)
        .order_by(Disease.name)
    )
    if base_filters:
        q = q.where(*base_filters)

    result = await db.execute(q)
    return [
        DiseaseSummaryRow(
            disease_name=r.disease_name,
            total_count=r.total_count or 0,
            this_month_count=int(r.this_month_count or 0),
            submitted_count=int(r.submitted_count or 0),
            locked_count=int(r.locked_count or 0),
        )
        for r in result.all()
    ]


# ---------------------------------------------------------------------------
# GET /patient-statistics
# ---------------------------------------------------------------------------

@router.get(
    "/patient-statistics",
    response_model=PatientStatistics,
    summary="Numeric and categorical statistics from assessment form data",
)
async def get_patient_statistics(
    disease_id: Optional[int] = Query(None),
    current_user: User = Depends(role_required(_ANALYTICS_ROLES)),
    db: AsyncSession = Depends(get_db),
) -> PatientStatistics:
    """
    Computes statistics across all assessments (optionally filtered by disease).
    - Numeric fields: mean, median, range
    - Categorical/text fields: category counts
    - Also computes Age statistics from patients table.
    """
    import statistics as stats_mod
    from collections import Counter, defaultdict

    # Build base query: assessments joined with patients
    base_q = select(Assessment.form_data, Patient.date_of_birth).join(
        Patient, Assessment.patient_id == Patient.id
    )
    if disease_id is not None:
        base_q = base_q.where(Assessment.disease_id == disease_id)

    result = await db.execute(base_q)
    rows = result.all()

    if not rows:
        return PatientStatistics(numeric_stats=[], categorical_stats=[])

    # Collect ages
    today = date.today()
    ages: list[float] = []
    for row in rows:
        dob = row.date_of_birth
        if dob:
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            ages.append(float(age))

    # Collect form_data values per field
    numeric_fields: dict[str, list[float]] = defaultdict(list)
    categorical_fields: dict[str, list[str]] = defaultdict(list)

    for row in rows:
        form_data = row.form_data
        if not isinstance(form_data, dict):
            continue
        for key, value in form_data.items():
            if value is None or value == "":
                continue
            # Try to parse as numeric
            try:
                num_val = float(value)
                numeric_fields[key].append(num_val)
            except (ValueError, TypeError):
                categorical_fields[key].append(str(value))

    # Build numeric stats
    numeric_stats: list[NumericStatRow] = []

    # Age stats first
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

    # Form data numeric fields
    for field_name, values in sorted(numeric_fields.items()):
        if len(values) < 1:
            continue
        mean_val = round(stats_mod.mean(values), 1)
        median_val = round(stats_mod.median(values), 1) if len(values) >= 1 else mean_val
        numeric_stats.append(
            NumericStatRow(
                title=field_name.replace("_", " ").title(),
                mean=mean_val,
                median=median_val,
                range_min=min(values),
                range_max=max(values),
            )
        )

    # Build categorical stats
    categorical_stats: list[CategoricalStatRow] = []
    for field_name, values in sorted(categorical_fields.items()):
        counter = Counter(values)
        categories = [
            CategoryCount(label=label, count=count)
            for label, count in counter.most_common(20)
        ]
        if categories:
            categorical_stats.append(
                CategoricalStatRow(field=field_name, categories=categories)
            )

    return PatientStatistics(
        numeric_stats=numeric_stats,
        categorical_stats=categorical_stats,
    )

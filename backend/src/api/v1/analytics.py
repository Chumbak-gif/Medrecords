"""Analytics router — thin controller delegating to use cases.

Preserves all existing endpoint paths, methods, query params, and response shapes.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from src.api.v1.dependencies.auth import role_required
from src.api.v1.dependencies.container import get_analytics_use_case
from src.application.use_cases.analytics.get_analytics import (
    GetAnalyticsUseCase,
    GetByDiseaseQuery,
    GetDiseaseSummaryQuery,
    GetKpisQuery,
    GetMonthlyVolumeQuery,
    GetPatientStatisticsQuery,
    GetTrendQuery,
)
from src.domain.entities.user import UserEntity
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Analytics"])

# Doctors can access analytics, scoped to their own patients/assessments
# (enforced in the use case layer via the `actor` on each query).
_ANALYTICS_ROLES = ["admin", "sys_admin", "pharma_viewer", "doctor"]


# --- Response schemas ---

class AdminKpis(BaseModel):
    total_assessments: int
    this_month_assessments: int
    active_patients: int
    active_doctors: int
    active_diseases: int


class MonthlyVolumeItem(BaseModel):
    month: str
    count: int


class DiseaseDistributionItem(BaseModel):
    disease_name: str
    count: int


class TrendItem(BaseModel):
    date: str
    count: int


class DiseaseSummaryRow(BaseModel):
    disease_name: str
    total_count: int
    this_month_count: int
    submitted_count: int
    locked_count: int


class NumericStatRow(BaseModel):
    title: str
    mean: float
    median: float
    range_min: float
    range_max: float


class CategoryCount(BaseModel):
    label: str
    count: int


class CategoricalStatRow(BaseModel):
    field: str
    categories: list[CategoryCount]


class PatientStatistics(BaseModel):
    numeric_stats: list[NumericStatRow]
    categorical_stats: list[CategoricalStatRow]


# --- Helpers ---

def _to_actor(user_model: UserModel) -> UserEntity:
    return UserEntity(
        id=user_model.id,
        username=user_model.username,
        email=user_model.email,
        full_name=user_model.full_name,
        hashed_password=user_model.hashed_password,
        role=user_model.role,
        specialty=user_model.specialty,
        is_active=user_model.is_active,
        created_at=user_model.created_at,
        updated_at=user_model.updated_at,
    )


# --- Endpoints ---

@router.get("/kpis", response_model=AdminKpis, summary="Admin dashboard KPI cards")
async def get_admin_kpis(
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> AdminKpis:
    query = GetKpisQuery(actor=_to_actor(current_user))
    result = await use_case.get_kpis(query)
    return AdminKpis(
        total_assessments=result.total_assessments,
        this_month_assessments=result.this_month_assessments,
        active_patients=result.active_patients,
        active_doctors=result.active_doctors,
        active_diseases=result.active_diseases,
    )


@router.get("/monthly-volume", response_model=list[MonthlyVolumeItem], summary="Monthly assessment count for trailing 12 months")
async def get_monthly_volume(
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> list[MonthlyVolumeItem]:
    query = GetMonthlyVolumeQuery(actor=_to_actor(current_user))
    items = await use_case.get_monthly_volume(query)
    return [MonthlyVolumeItem(month=item.month, count=item.count) for item in items]


@router.get("/by-disease", response_model=list[DiseaseDistributionItem], summary="Assessment count per disease")
async def get_by_disease(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> list[DiseaseDistributionItem]:
    query = GetByDiseaseQuery(
        from_date=from_date,
        to_date=to_date,
        actor=_to_actor(current_user),
    )
    items = await use_case.get_by_disease(query)
    return [DiseaseDistributionItem(disease_name=item.disease_name, count=item.count) for item in items]


@router.get("/trend", response_model=list[TrendItem], summary="Assessment count per day over date range")
async def get_trend(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> list[TrendItem]:
    query = GetTrendQuery(
        from_date=from_date,
        to_date=to_date,
        actor=_to_actor(current_user),
    )
    items = await use_case.get_trend(query)
    return [TrendItem(date=item.date, count=item.count) for item in items]


@router.get("/disease-summary", response_model=list[DiseaseSummaryRow], summary="Per-disease statistical summary table")
async def get_disease_summary(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    disease_id: Optional[int] = Query(None),
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> list[DiseaseSummaryRow]:
    query = GetDiseaseSummaryQuery(
        from_date=from_date,
        to_date=to_date,
        disease_id=disease_id,
        actor=_to_actor(current_user),
    )
    items = await use_case.get_disease_summary(query)
    return [
        DiseaseSummaryRow(
            disease_name=item.disease_name,
            total_count=item.total_count,
            this_month_count=item.this_month_count,
            submitted_count=item.submitted_count,
            locked_count=item.locked_count,
        )
        for item in items
    ]


@router.get("/patient-statistics", response_model=PatientStatistics, summary="Numeric and categorical statistics from assessment form data")
async def get_patient_statistics(
    disease_id: Optional[int] = Query(None),
    current_user: UserModel = Depends(role_required(_ANALYTICS_ROLES)),
    use_case: GetAnalyticsUseCase = Depends(get_analytics_use_case),
) -> PatientStatistics:
    query = GetPatientStatisticsQuery(
        disease_id=disease_id,
        actor=_to_actor(current_user),
    )
    result = await use_case.get_patient_statistics(query)
    return PatientStatistics(
        numeric_stats=[
            NumericStatRow(
                title=row.title,
                mean=row.mean,
                median=row.median,
                range_min=row.range_min,
                range_max=row.range_max,
            )
            for row in result.numeric_stats
        ],
        categorical_stats=[
            CategoricalStatRow(
                field=row.field,
                categories=[CategoryCount(label=c.label, count=c.count) for c in row.categories],
            )
            for row in result.categorical_stats
        ],
    )

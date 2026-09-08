from pydantic import BaseModel


class AdminKpis(BaseModel):
    total_assessments: int
    this_month_assessments: int
    active_patients: int
    active_doctors: int
    active_diseases: int


class MonthlyVolumeItem(BaseModel):
    month: str   # "YYYY-MM"
    count: int


class DiseaseDistributionItem(BaseModel):
    disease_name: str
    count: int


class TrendItem(BaseModel):
    date: str    # "YYYY-MM-DD"
    count: int


class DiseaseSummaryRow(BaseModel):
    disease_name: str
    total_count: int
    this_month_count: int
    submitted_count: int
    locked_count: int


# ---------------------------------------------------------------------------
# Patient Statistics schemas
# ---------------------------------------------------------------------------

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

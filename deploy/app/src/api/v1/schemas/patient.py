"""Patient request/response schemas — mirrors app/schemas/patient.py exactly."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Request DTOs
# ---------------------------------------------------------------------------

class RegisterPatientDto(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    contact_number: str
    email: Optional[str] = None


class UpdatePatientDto(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PatientResponse(BaseModel):
    id: int
    patient_uid: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    contact_number: str
    email: Optional[str] = None
    registered_by: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VisitSummary(BaseModel):
    assessment_id: int
    visit_date: datetime
    disease_name: str
    status: str

    model_config = {"from_attributes": True}


class PatientDetail(PatientResponse):
    visits: list[VisitSummary] = []

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class CreateAssessmentDto(BaseModel):
    patient_id: int
    disease_id: int
    sub_disease_id: Optional[int] = None
    template_id: int


class UpdateAssessmentDto(BaseModel):
    form_data: Optional[dict] = None
    consent_given: Optional[bool] = None


class PrescriptionRowResponse(BaseModel):
    id: int
    assessment_id: int
    medicine_id: int
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None
    sort_order: int

    model_config = {"from_attributes": True}


class AssessmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    disease_id: int
    sub_disease_id: Optional[int] = None
    template_id: int
    template_snapshot: dict
    form_data: dict
    status: str
    consent_given: bool
    draft_saved_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    lock_expires_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Denormalized display fields
    patient_name: Optional[str] = None
    patient_uid: Optional[str] = None
    disease_name: Optional[str] = None
    sub_disease_name: Optional[str] = None

    model_config = {"from_attributes": True}


class AssessmentPatientResponse(BaseModel):
    """Nested patient info for assessment detail."""
    first_name: str
    last_name: str
    patient_uid: str
    date_of_birth: date
    gender: str
    contact_number: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class AssessmentDetail(AssessmentResponse):
    """Full assessment response including prescription rows and patient."""
    prescription_rows: list[PrescriptionRowResponse] = []
    prescriptions: list[PrescriptionRowResponse] = []
    patient: Optional[AssessmentPatientResponse] = None

    model_config = {"from_attributes": True}


class DoctorKpis(BaseModel):
    total_patients: int
    this_month_submitted: int
    drafts: int
    locked: int
    today_visits: int = 0
    pending_followups: int = 0

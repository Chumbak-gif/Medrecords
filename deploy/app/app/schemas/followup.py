from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class FollowupCreate(BaseModel):
    patient_id: int
    assessment_id: Optional[int] = None
    scheduled_date: date
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("scheduled_date")
    @classmethod
    def date_must_be_future(cls, v: date) -> date:
        from datetime import date as date_type

        today = date_type.today()
        delta = (v - today).days
        if delta < 1:
            raise ValueError("scheduled_date must be at least 1 day in the future")
        if delta > 365:
            raise ValueError("scheduled_date must be no more than 365 days from today")
        return v


class FollowupUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "completed", "cancelled"):
            raise ValueError("status must be one of: pending, completed, cancelled")
        return v

    @field_validator("scheduled_date")
    @classmethod
    def date_must_be_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None:
            from datetime import date as date_type

            today = date_type.today()
            delta = (v - today).days
            if delta < 1:
                raise ValueError("scheduled_date must be at least 1 day in the future")
            if delta > 365:
                raise ValueError("scheduled_date must be no more than 365 days from today")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class FollowupResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    assessment_id: Optional[int] = None
    scheduled_date: date
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    # Denormalized display fields (populated by router)
    patient_name: Optional[str] = None
    patient_uid: Optional[str] = None
    disease_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Dashboard schema
# ---------------------------------------------------------------------------


class FollowupDashboard(BaseModel):
    pending_count: int
    today_followups: list[FollowupResponse]

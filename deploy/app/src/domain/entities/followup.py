"""Followup domain entity."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class FollowupEntity:
    """Framework-agnostic representation of a Followup."""

    id: Optional[int] = None
    patient_id: int = 0
    doctor_id: int = 0
    assessment_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

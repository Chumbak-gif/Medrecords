"""Patient domain entity."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class PatientEntity:
    """Framework-agnostic representation of a Patient."""

    id: Optional[int] = None
    patient_uid: str = ""
    first_name: str = ""
    last_name: str = ""
    date_of_birth: Optional[date] = None
    gender: str = ""
    contact_number: str = ""
    email: Optional[str] = None
    registered_by: Optional[int] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

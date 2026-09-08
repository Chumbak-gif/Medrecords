"""ConsentRecord domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class ConsentRecordEntity:
    """Framework-agnostic representation of a Consent Record."""

    id: Optional[int] = None
    assessment_id: int = 0
    patient_id: int = 0
    doctor_id: int = 0
    consent_statement_version: str = ""
    consented_at: Optional[datetime] = None

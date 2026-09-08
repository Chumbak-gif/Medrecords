"""PrescriptionRow domain entity."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class PrescriptionRowEntity:
    """Framework-agnostic representation of a Prescription Row."""

    id: Optional[int] = None
    assessment_id: int = 0
    medicine_id: int = 0
    dosage: str = ""
    frequency: str = ""
    duration: str = ""
    instructions: Optional[str] = None
    sort_order: int = 0

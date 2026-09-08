"""Assessment domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class AssessmentEntity:
    """Framework-agnostic representation of an Assessment."""

    id: Optional[int] = None
    patient_id: int = 0
    doctor_id: int = 0
    disease_id: int = 0
    sub_disease_id: Optional[int] = None
    template_id: int = 0
    template_snapshot: dict[str, Any] = None  # type: ignore[assignment]
    form_data: dict[str, Any] = None  # type: ignore[assignment]
    status: str = ""
    consent_given: bool = False
    draft_saved_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    lock_expires_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self) -> None:
        if self.template_snapshot is None:
            self.template_snapshot = {}
        if self.form_data is None:
            self.form_data = {}

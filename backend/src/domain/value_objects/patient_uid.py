"""PatientUid value object — enforces PAT-XXXXXX format."""

from __future__ import annotations

import re
from dataclasses import dataclass

from src.domain.exceptions import ValidationError

_UID_PATTERN = re.compile(r"^PAT-\d{6}$")


@dataclass(frozen=True)
class PatientUid:
    """Immutable value object representing a patient unique identifier.

    Format: PAT-XXXXXX where X is a digit (e.g. PAT-000001).
    """

    value: str

    def __post_init__(self) -> None:
        if not _UID_PATTERN.match(self.value):
            raise ValidationError(
                f"Invalid patient UID format: '{self.value}'. Expected PAT-XXXXXX."
            )

    @classmethod
    def from_sequence(cls, sequence_number: int) -> PatientUid:
        """Create a PatientUid from a sequence number (1-based)."""
        if sequence_number < 1 or sequence_number > 999999:
            raise ValidationError(
                f"Sequence number must be between 1 and 999999, got {sequence_number}."
            )
        return cls(value=f"PAT-{sequence_number:06d}")

    def __str__(self) -> str:
        return self.value

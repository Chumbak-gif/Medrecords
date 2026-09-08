"""ContactNumber value object — validates phone/contact number format."""

from __future__ import annotations

import re
from dataclasses import dataclass

from src.domain.exceptions import ValidationError

# Accepts digits, spaces, hyphens, parentheses, and optional leading +
# Minimum 7 digits, maximum 20 characters total
_CONTACT_PATTERN = re.compile(r"^\+?[\d\s\-()]{7,20}$")


@dataclass(frozen=True)
class ContactNumber:
    """Immutable value object representing a patient contact number.

    Validates that the number contains between 7 and 20 characters
    consisting of digits, spaces, hyphens, parentheses, and an optional
    leading '+'.
    """

    value: str

    def __post_init__(self) -> None:
        if not self.value or not self.value.strip():
            raise ValidationError("Contact number must not be empty.")
        if not _CONTACT_PATTERN.match(self.value):
            raise ValidationError(
                f"Invalid contact number format: '{self.value}'."
            )

    def __str__(self) -> str:
        return self.value

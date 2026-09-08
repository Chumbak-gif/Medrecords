"""Domain value objects — immutable, identity-less domain concepts."""

from src.domain.value_objects.patient_uid import PatientUid
from src.domain.value_objects.contact_number import ContactNumber

__all__ = [
    "PatientUid",
    "ContactNumber",
]

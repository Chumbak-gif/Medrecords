"""Abstract patient UID generator service interface."""

from abc import ABC, abstractmethod

from src.domain.value_objects.patient_uid import PatientUid


class PatientUidGenerator(ABC):
    """Defines the contract for generating sequential patient UIDs.

    Implementations must produce unique UIDs in PAT-XXXXXX format
    (e.g. PAT-000001, PAT-000002, ...).
    """

    @abstractmethod
    async def generate_next(self) -> PatientUid:
        """Generate the next sequential patient UID.

        Returns:
            A new PatientUid value object with the next available sequence.
        """
        ...

"""Get Patient use case — fetch by ID with access control check."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.patient import PatientEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class GetPatientQuery:
    """Input for retrieving a single patient."""

    patient_id: int = 0
    actor: Optional[UserEntity] = None


class GetPatientUseCase:
    """Fetch a patient by ID with doctor-scoping access control."""

    def __init__(
        self,
        patient_repo: PatientRepository,
        assessment_repo: AssessmentRepository,
        access_control: AccessControlService,
    ) -> None:
        self._patient_repo = patient_repo
        self._assessment_repo = assessment_repo
        self._access_control = access_control

    async def execute(self, query: GetPatientQuery) -> PatientEntity:
        """Retrieve a patient, enforcing access control.

        Raises:
            NotFoundError: If the patient does not exist or is inactive.
            ForbiddenError: If the actor (doctor) cannot access this patient.
        """
        patient = await self._patient_repo.get_by_id(query.patient_id)
        if patient is None or not patient.is_active:
            raise NotFoundError("Patient not found")

        # Doctor-scoped access: doctor must have registered OR assessed the patient
        if not self._access_control.is_privileged(query.actor):
            # Check if doctor has assessments for this patient
            assessments = await self._assessment_repo.list(
                offset=0,
                limit=1,
                patient_id=query.patient_id,
                doctor_id=query.actor.id,
            )
            doctor_ids_who_assessed = [query.actor.id] if assessments else []

            self._access_control.assert_can_access_patient(
                user=query.actor,
                patient_registered_by=patient.registered_by,
                doctor_ids_who_assessed=doctor_ids_who_assessed,
            )

        return patient

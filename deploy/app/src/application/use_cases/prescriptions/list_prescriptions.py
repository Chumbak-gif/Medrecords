"""List Prescriptions use case — list prescription rows for an assessment."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.prescription_row import PrescriptionRowEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.prescription_repository import PrescriptionRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ListPrescriptionsQuery:
    """Input parameters for listing prescriptions."""

    assessment_id: int = 0
    actor: Optional[UserEntity] = None


class ListPrescriptionsUseCase:
    """Lists prescription rows for an assessment with doctor-scoping."""

    def __init__(
        self,
        prescription_repo: PrescriptionRepository,
        assessment_repo: AssessmentRepository,
        access_control: AccessControlService,
    ) -> None:
        self._prescription_repo = prescription_repo
        self._assessment_repo = assessment_repo
        self._access_control = access_control

    async def execute(self, query: ListPrescriptionsQuery) -> list[PrescriptionRowEntity]:
        """Retrieve prescription rows for an assessment.

        Raises:
            NotFoundError: If the assessment does not exist.
            ForbiddenError: If the actor cannot access the assessment.
        """
        assessment = await self._assessment_repo.get_by_id(query.assessment_id)
        if assessment is None:
            raise NotFoundError("Assessment not found")

        # Doctor-scoping
        if not self._access_control.is_privileged(query.actor):
            if assessment.doctor_id != query.actor.id:
                raise ForbiddenError(
                    "You do not have permission to access this assessment"
                )

        rows = await self._prescription_repo.list(
            assessment_id=query.assessment_id,
        )
        return rows

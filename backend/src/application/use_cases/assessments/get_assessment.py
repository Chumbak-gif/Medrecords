"""Get Assessment use case — fetch by ID with doctor-scoping."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class GetAssessmentQuery:
    """Input for retrieving a single assessment."""

    assessment_id: int = 0
    actor: Optional[UserEntity] = None


class GetAssessmentUseCase:
    """Fetch an assessment by ID with doctor-scoping access control."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        access_control: AccessControlService,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._access_control = access_control

    async def execute(self, query: GetAssessmentQuery) -> AssessmentEntity:
        """Retrieve an assessment, enforcing doctor-scoping.

        Raises:
            NotFoundError: If the assessment does not exist.
            ForbiddenError: If the actor (doctor) cannot access this assessment.
        """
        assessment = await self._assessment_repo.get_by_id(query.assessment_id)
        if assessment is None:
            raise NotFoundError("Assessment not found")

        # Doctors can only see their own assessments
        if not self._access_control.is_privileged(query.actor):
            if assessment.doctor_id != query.actor.id:
                raise ForbiddenError(
                    "You do not have permission to access this assessment"
                )

        return assessment

"""Create Followup use case — validate references, create with pending status."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.followup_repository import FollowupRepository
from src.domain.repositories.patient_repository import PatientRepository


@dataclass
class CreateFollowupCommand:
    """Input data for creating a new followup."""

    patient_id: int = 0
    assessment_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None
    actor: Optional[UserEntity] = None


class CreateFollowupUseCase:
    """Creates a new followup in pending status (doctor only)."""

    def __init__(
        self,
        followup_repo: FollowupRepository,
        patient_repo: PatientRepository,
        assessment_repo: AssessmentRepository,
        uow: UnitOfWork,
    ) -> None:
        self._followup_repo = followup_repo
        self._patient_repo = patient_repo
        self._assessment_repo = assessment_repo
        self._uow = uow

    async def execute(self, command: CreateFollowupCommand) -> FollowupEntity:
        """Create a followup.

        Raises:
            NotFoundError: If patient or assessment doesn't exist.
        """
        async with self._uow:
            # Validate patient exists
            patient = await self._patient_repo.get_by_id(command.patient_id)
            if patient is None:
                raise NotFoundError("Patient not found")

            # Validate assessment exists if provided
            if command.assessment_id is not None:
                assessment = await self._assessment_repo.get_by_id(command.assessment_id)
                if assessment is None:
                    raise NotFoundError("Assessment not found")

            followup = FollowupEntity(
                patient_id=command.patient_id,
                doctor_id=command.actor.id,
                assessment_id=command.assessment_id,
                scheduled_date=command.scheduled_date,
                notes=command.notes,
                status="pending",
            )
            followup = await self._followup_repo.add(followup)

            await self._uow.commit()
            return followup

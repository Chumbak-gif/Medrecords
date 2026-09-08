"""Update Followup use case — state machine enforcement for status transitions."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError, ValidationError
from src.domain.repositories.followup_repository import FollowupRepository

# Valid state transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
}


@dataclass
class UpdateFollowupCommand:
    """Input data for updating a followup."""

    followup_id: int = 0
    status: Optional[str] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None
    actor: Optional[UserEntity] = None


class UpdateFollowupUseCase:
    """Updates a followup with state machine enforcement."""

    def __init__(
        self,
        followup_repo: FollowupRepository,
        uow: UnitOfWork,
    ) -> None:
        self._followup_repo = followup_repo
        self._uow = uow

    async def execute(self, command: UpdateFollowupCommand) -> FollowupEntity:
        """Update a followup.

        Raises:
            NotFoundError: If the followup does not exist.
            ForbiddenError: If the actor is not the owning doctor.
            ValidationError: If the status transition is invalid.
        """
        async with self._uow:
            followup = await self._followup_repo.get_by_id(command.followup_id)
            if followup is None:
                raise NotFoundError("Follow-up not found")

            # Doctor can only modify their own followups
            if followup.doctor_id != command.actor.id:
                raise ForbiddenError(
                    "You do not have permission to access this follow-up"
                )

            # State machine enforcement
            if command.status is not None and command.status != followup.status:
                allowed = VALID_TRANSITIONS.get(followup.status, [])
                if command.status not in allowed:
                    raise ValidationError(
                        f"Cannot transition from '{followup.status}' to '{command.status}'. "
                        f"Allowed transitions: {allowed or 'none'}"
                    )
                followup.status = command.status

            if command.scheduled_date is not None:
                followup.scheduled_date = command.scheduled_date

            if command.notes is not None:
                followup.notes = command.notes

            followup = await self._followup_repo.update(followup)

            await self._uow.commit()
            return followup

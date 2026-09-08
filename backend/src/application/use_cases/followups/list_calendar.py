"""List Calendar Followups use case — date range retrieval for calendar view."""

from dataclasses import dataclass
from datetime import date as date_type
from typing import Optional

from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ValidationError
from src.domain.repositories.followup_repository import FollowupRepository


@dataclass
class ListCalendarQuery:
    """Input for listing followups within a date range."""

    start_date: date_type = None  # type: ignore[assignment]
    end_date: date_type = None  # type: ignore[assignment]
    actor: Optional[UserEntity] = None


class ListCalendarFollowupsUseCase:
    """Lists followups for the calendar view within a date range."""

    def __init__(self, followup_repo: FollowupRepository) -> None:
        self._followup_repo = followup_repo

    async def execute(self, query: ListCalendarQuery) -> list[FollowupEntity]:
        """Retrieve followups within the date range.

        Raises:
            ValidationError: If the date range is invalid.
        """
        if query.end_date < query.start_date:
            raise ValidationError("end_date must be greater than or equal to start_date")

        delta = (query.end_date - query.start_date).days
        if delta > 42:
            raise ValidationError("Date range must not exceed 42 days")

        followups = await self._followup_repo.list(
            offset=0,
            limit=10000,
            doctor_id=query.actor.id,
            scheduled_from=query.start_date,
            scheduled_to=query.end_date,
        )

        return followups

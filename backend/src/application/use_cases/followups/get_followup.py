"""Get Followup use case — retrieve a single followup with enriched data."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError
from src.domain.repositories.followup_repository import FollowupRepository


@dataclass
class GetFollowupQuery:
    """Input for retrieving a followup by ID."""

    followup_id: int = 0
    actor: Optional[UserEntity] = None


class GetFollowupUseCase:
    """Retrieves a followup by ID (doctor-scoped)."""

    def __init__(self, followup_repo: FollowupRepository) -> None:
        self._followup_repo = followup_repo

    async def execute(self, query: GetFollowupQuery) -> FollowupEntity:
        """Retrieve a followup by ID.

        Raises:
            NotFoundError: If the followup does not exist.
            ForbiddenError: If the actor is not the owning doctor.
        """
        followup = await self._followup_repo.get_by_id(query.followup_id)
        if followup is None:
            raise NotFoundError("Follow-up not found")
        is_admin = query.actor is not None and query.actor.role in ("admin", "sys_admin")
        if not is_admin and followup.doctor_id != query.actor.id:
            raise ForbiddenError("You do not have permission to access this follow-up")
        return followup

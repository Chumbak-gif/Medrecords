"""Get Followup Dashboard use case — pending count + today's followups."""

from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Optional

from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.followup_repository import FollowupRepository


@dataclass
class GetDashboardQuery:
    """Input for retrieving the followup dashboard."""

    actor: Optional[UserEntity] = None


@dataclass
class DashboardResult:
    """Dashboard data: pending count + today's followups."""

    pending_count: int = 0
    today_followups: list[FollowupEntity] = field(default_factory=list)


class GetFollowupDashboardUseCase:
    """Retrieves followup dashboard data for the current doctor."""

    def __init__(self, followup_repo: FollowupRepository) -> None:
        self._followup_repo = followup_repo

    async def execute(self, query: GetDashboardQuery) -> DashboardResult:
        """Retrieve dashboard data."""
        doctor_id = query.actor.id

        pending_count = await self._followup_repo.count(
            doctor_id=doctor_id,
            status="pending",
        )

        today = date_type.today()
        today_followups = await self._followup_repo.list(
            offset=0,
            limit=1000,
            doctor_id=doctor_id,
            status="pending",
            scheduled_from=today,
            scheduled_to=today,
        )

        return DashboardResult(
            pending_count=pending_count,
            today_followups=today_followups,
        )

"""List Followups use case — paginated listing scoped to current doctor."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.followup_repository import FollowupRepository


@dataclass
class ListFollowupsQuery:
    """Input parameters for listing followups."""

    page: int = 1
    page_size: int = 20
    status: Optional[str] = None
    patient_id: Optional[int] = None
    actor: Optional[UserEntity] = None


@dataclass
class PaginatedResult:
    """Paginated result container for followups."""

    items: list[FollowupEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListFollowupsUseCase:
    """Lists followups scoped to the current doctor with pagination."""

    def __init__(self, followup_repo: FollowupRepository) -> None:
        self._followup_repo = followup_repo

    async def execute(self, query: ListFollowupsQuery) -> PaginatedResult:
        """Retrieve paginated followups for the doctor."""
        offset = (query.page - 1) * query.page_size

        followups = await self._followup_repo.list(
            offset=offset,
            limit=query.page_size,
            doctor_id=query.actor.id,
            patient_id=query.patient_id,
            status=query.status,
        )

        total = await self._followup_repo.count(
            doctor_id=query.actor.id,
            patient_id=query.patient_id,
            status=query.status,
        )

        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=followups,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

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
    # When False, the actor's own id is NOT used to scope results (e.g. an
    # admin/sys_admin viewing a specific patient's follow-ups across all
    # doctors). Doctors always get their own-id scoping regardless of this flag.
    scope_to_actor: bool = True


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
        """Retrieve paginated followups, scoped to the doctor unless the
        actor is an admin/sys_admin viewing a specific patient's record."""
        offset = (query.page - 1) * query.page_size

        is_doctor = query.actor is not None and query.actor.role == "doctor"
        doctor_id = query.actor.id if (is_doctor or query.scope_to_actor) and query.actor else None

        followups = await self._followup_repo.list(
            offset=offset,
            limit=query.page_size,
            doctor_id=doctor_id,
            patient_id=query.patient_id,
            status=query.status,
        )

        total = await self._followup_repo.count(
            doctor_id=doctor_id,
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

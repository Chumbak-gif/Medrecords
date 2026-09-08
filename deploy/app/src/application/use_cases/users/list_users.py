"""List Users use case — paginated listing with search and role filter (admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ListUsersQuery:
    """Input parameters for listing users."""

    page: int = 1
    page_size: int = 20
    search: str = ""
    role: Optional[str] = None
    actor: Optional[UserEntity] = None


@dataclass
class PaginatedResult:
    """Paginated result container for users."""

    items: list[UserEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListUsersUseCase:
    """Lists users with pagination and filtering (admin/sys_admin only)."""

    def __init__(
        self,
        user_repo: UserRepository,
        access_control: AccessControlService,
    ) -> None:
        self._user_repo = user_repo
        self._access_control = access_control

    async def execute(self, query: ListUsersQuery) -> PaginatedResult:
        """Retrieve paginated user list.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
        """
        self._access_control.assert_can_manage_users(query.actor)

        offset = (query.page - 1) * query.page_size

        users = await self._user_repo.list(
            offset=offset,
            limit=query.page_size,
            search=query.search,
            role=query.role,
        )

        total = await self._user_repo.count(search=query.search, role=query.role)
        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=users,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

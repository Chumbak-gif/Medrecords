"""Get User use case — retrieve a single user by ID (admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class GetUserQuery:
    """Input data for getting a user by ID."""

    user_id: int = 0
    actor: Optional[UserEntity] = None


class GetUserUseCase:
    """Retrieves a single user by ID (admin/sys_admin only)."""

    def __init__(
        self,
        user_repo: UserRepository,
        access_control: AccessControlService,
    ) -> None:
        self._user_repo = user_repo
        self._access_control = access_control

    async def execute(self, query: GetUserQuery) -> UserEntity:
        """Get a user by ID.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the user does not exist.
        """
        self._access_control.assert_can_manage_users(query.actor)

        user = await self._user_repo.get_by_id(query.user_id)
        if user is None:
            raise NotFoundError("User not found")

        return user

"""Get Current User use case — decode token, fetch user."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.exceptions import ValidationError
from src.domain.repositories.user_repository import UserRepository


@dataclass
class GetCurrentUserQuery:
    """Input for resolving the current user from a token."""

    username: str = ""


class GetCurrentUserUseCase:
    """Resolves a user entity from a decoded token subject (username)."""

    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def execute(self, query: GetCurrentUserQuery) -> UserEntity:
        """Fetch the user by username (from decoded JWT sub claim).

        Raises:
            ValidationError: If the user is not found or inactive.
        """
        user = await self._user_repo.get_by_username(query.username)
        if user is None or not user.is_active:
            raise ValidationError("Could not validate credentials")
        return user

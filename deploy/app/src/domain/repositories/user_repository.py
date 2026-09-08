"""Abstract user repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.user import UserEntity


class IUserRepository(ABC):
    """Defines the contract for user data access."""

    @abstractmethod
    async def get_by_id(self, user_id: int) -> Optional[UserEntity]:
        """Retrieve a user by primary key."""
        ...

    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[UserEntity]:
        """Retrieve a user by unique username."""
        ...

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        """Retrieve a user by unique email."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        search: str = "",
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[UserEntity]:
        """Return a paginated list of users with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        search: str = "",
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, user: UserEntity) -> UserEntity:
        """Persist a new user and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, user: UserEntity) -> UserEntity:
        """Update an existing user record."""
        ...

    @abstractmethod
    async def delete(self, user_id: int) -> None:
        """Delete a user by primary key."""
        ...


# Backward-compatible alias
UserRepository = IUserRepository

"""Abstract application config repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.app_config import AppConfigEntity


class IConfigRepository(ABC):
    """Defines the contract for application config data access."""

    @abstractmethod
    async def get_by_id(self, config_id: int) -> Optional[AppConfigEntity]:
        """Retrieve a config entry by primary key."""
        ...

    @abstractmethod
    async def get_by_key(self, config_key: str) -> Optional[AppConfigEntity]:
        """Retrieve a config entry by unique key."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> list[AppConfigEntity]:
        """Return a paginated list of config entries."""
        ...

    @abstractmethod
    async def count(self) -> int:
        """Return total count of config entries."""
        ...

    @abstractmethod
    async def add(self, config: AppConfigEntity) -> AppConfigEntity:
        """Persist a new config entry and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, config: AppConfigEntity) -> AppConfigEntity:
        """Update an existing config entry."""
        ...

    @abstractmethod
    async def delete(self, config_id: int) -> None:
        """Delete a config entry by primary key."""
        ...


# Backward-compatible alias
ConfigRepository = IConfigRepository

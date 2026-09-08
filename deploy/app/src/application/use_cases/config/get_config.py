"""Get Config use case — list all config key-value pairs."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.app_config import AppConfigEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.config_repository import ConfigRepository


@dataclass
class GetConfigQuery:
    """Input for retrieving configuration."""

    actor: Optional[UserEntity] = None


class GetConfigUseCase:
    """Retrieves all application configuration key-value pairs."""

    def __init__(self, config_repo: ConfigRepository) -> None:
        self._config_repo = config_repo

    async def execute(self, query: GetConfigQuery) -> list[AppConfigEntity]:
        """Retrieve all config entries."""
        return await self._config_repo.list(offset=0, limit=1000)

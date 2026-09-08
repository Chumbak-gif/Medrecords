"""List Diseases use case — paginated listing with search and active filter."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.disease import DiseaseEntity
from src.domain.repositories.disease_repository import DiseaseRepository


@dataclass
class ListDiseasesQuery:
    """Input parameters for listing diseases."""

    page: int = 1
    page_size: int = 20
    search: str = ""
    include_inactive: bool = False


@dataclass
class PaginatedResult:
    """Paginated result container for diseases."""

    items: list[DiseaseEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListDiseasesUseCase:
    """Lists diseases with pagination and optional search/active filtering."""

    def __init__(self, disease_repo: DiseaseRepository) -> None:
        self._disease_repo = disease_repo

    async def execute(self, query: ListDiseasesQuery) -> PaginatedResult:
        """Retrieve a paginated list of diseases."""
        is_active = None if query.include_inactive else True
        offset = (query.page - 1) * query.page_size

        diseases = await self._disease_repo.list(
            offset=offset,
            limit=query.page_size,
            search=query.search,
            is_active=is_active,
        )

        total = await self._disease_repo.count(search=query.search, is_active=is_active)
        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=diseases,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

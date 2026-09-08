"""List Medicines use case — paginated listing with search and active filter."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.medicine import MedicineEntity
from src.domain.repositories.medicine_repository import MedicineRepository


@dataclass
class ListMedicinesQuery:
    """Input parameters for listing medicines."""

    page: int = 1
    page_size: int = 20
    search: str = ""
    include_inactive: bool = False


@dataclass
class PaginatedResult:
    """Paginated result container for medicines."""

    items: list[MedicineEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListMedicinesUseCase:
    """Lists medicines with pagination and optional search/active filtering."""

    def __init__(self, medicine_repo: MedicineRepository) -> None:
        self._medicine_repo = medicine_repo

    async def execute(self, query: ListMedicinesQuery) -> PaginatedResult:
        """Retrieve a paginated list of medicines."""
        is_active = None if query.include_inactive else True
        offset = (query.page - 1) * query.page_size

        medicines = await self._medicine_repo.list(
            offset=offset,
            limit=query.page_size,
            is_active=is_active,
            search=query.search,
        )

        total = await self._medicine_repo.count(
            is_active=is_active,
            search=query.search,
        )
        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=medicines,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

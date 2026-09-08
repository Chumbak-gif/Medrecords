"""List Templates use case — paginated listing with disease filter."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.form_template import FormTemplateEntity
from src.domain.repositories.template_repository import TemplateRepository


@dataclass
class ListTemplatesQuery:
    """Input parameters for listing form templates."""

    page: int = 1
    page_size: int = 20
    disease_id: Optional[int] = None
    include_inactive: bool = False


@dataclass
class PaginatedResult:
    """Paginated result container for templates."""

    items: list[FormTemplateEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListTemplatesUseCase:
    """Lists form templates with pagination and optional disease/active filtering."""

    def __init__(self, template_repo: TemplateRepository) -> None:
        self._template_repo = template_repo

    async def execute(self, query: ListTemplatesQuery) -> PaginatedResult:
        """Retrieve a paginated list of form templates."""
        is_active = None if query.include_inactive else True
        offset = (query.page - 1) * query.page_size

        templates = await self._template_repo.list(
            offset=offset,
            limit=query.page_size,
            disease_id=query.disease_id,
            is_active=is_active,
        )

        total = await self._template_repo.count(
            disease_id=query.disease_id,
            is_active=is_active,
        )
        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=templates,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

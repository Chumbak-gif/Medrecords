"""Common/shared schemas used across multiple API endpoints."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper — matches existing API contract."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

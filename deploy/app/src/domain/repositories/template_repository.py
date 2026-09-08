"""Abstract form template repository interface (port)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities.form_template import FormTemplateEntity


class ITemplateRepository(ABC):
    """Defines the contract for form template data access."""

    @abstractmethod
    async def get_by_id(self, template_id: int) -> Optional[FormTemplateEntity]:
        """Retrieve a form template by primary key."""
        ...

    @abstractmethod
    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        disease_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> list[FormTemplateEntity]:
        """Return a paginated list of form templates with optional filters."""
        ...

    @abstractmethod
    async def count(
        self,
        *,
        disease_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Return total count matching the filter criteria."""
        ...

    @abstractmethod
    async def add(self, template: FormTemplateEntity) -> FormTemplateEntity:
        """Persist a new form template and return it with generated fields populated."""
        ...

    @abstractmethod
    async def update(self, template: FormTemplateEntity) -> FormTemplateEntity:
        """Update an existing form template record."""
        ...

    @abstractmethod
    async def delete(self, template_id: int) -> None:
        """Delete a form template by primary key."""
        ...

    @abstractmethod
    async def get_active_for_disease(self, disease_id: int) -> Optional[FormTemplateEntity]:
        """Get the currently active template for a given disease."""
        ...

    @abstractmethod
    async def deactivate_for_disease(self, disease_id: int) -> None:
        """Deactivate all active templates for a given disease."""
        ...


# Backward-compatible alias
TemplateRepository = ITemplateRepository

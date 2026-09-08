"""Get Template use case — retrieve a single template or active template for disease."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.form_template import FormTemplateEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.template_repository import TemplateRepository


@dataclass
class GetTemplateQuery:
    """Input for retrieving a template by ID."""

    template_id: int = 0


@dataclass
class GetActiveTemplateForDiseaseQuery:
    """Input for retrieving the active template for a disease."""

    disease_id: int = 0


class GetTemplateUseCase:
    """Retrieves a form template by ID or the active template for a disease."""

    def __init__(self, template_repo: TemplateRepository) -> None:
        self._template_repo = template_repo

    async def execute(self, query: GetTemplateQuery) -> FormTemplateEntity:
        """Retrieve a template by ID.

        Raises:
            NotFoundError: If the template does not exist.
        """
        template = await self._template_repo.get_by_id(query.template_id)
        if template is None:
            raise NotFoundError("Form template not found")
        return template

    async def get_active_for_disease(self, query: GetActiveTemplateForDiseaseQuery) -> FormTemplateEntity:
        """Retrieve the active template for a disease.

        Raises:
            NotFoundError: If no active template exists for the disease.
        """
        template = await self._template_repo.get_active_for_disease(query.disease_id)
        if template is None:
            raise NotFoundError(f"No active template found for disease id={query.disease_id}")
        return template

"""Get Disease use case — retrieve a single disease with its sub-diseases."""

from dataclasses import dataclass

from src.domain.entities.disease import DiseaseEntity, SubDiseaseEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.disease_repository import DiseaseRepository


@dataclass
class GetDiseaseQuery:
    """Input for getting a disease by ID."""

    disease_id: int = 0


@dataclass
class DiseaseWithSubDiseases:
    """Disease entity bundled with its sub-diseases."""

    disease: DiseaseEntity
    sub_diseases: list[SubDiseaseEntity]


class GetDiseaseUseCase:
    """Retrieves a disease and its sub-diseases."""

    def __init__(self, disease_repo: DiseaseRepository) -> None:
        self._disease_repo = disease_repo

    async def execute(self, query: GetDiseaseQuery) -> DiseaseWithSubDiseases:
        """Get a disease by ID with sub-diseases.

        Raises:
            NotFoundError: If the disease does not exist.
        """
        disease = await self._disease_repo.get_by_id(query.disease_id)
        if disease is None:
            raise NotFoundError("Disease not found")

        sub_diseases = await self._disease_repo.list_sub_diseases(
            query.disease_id, include_inactive=True
        )

        return DiseaseWithSubDiseases(disease=disease, sub_diseases=sub_diseases)

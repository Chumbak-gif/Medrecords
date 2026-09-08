"""List Sub-Diseases use case — list sub-diseases for a disease."""

from dataclasses import dataclass

from src.domain.entities.disease import SubDiseaseEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.disease_repository import DiseaseRepository


@dataclass
class ListSubDiseasesQuery:
    """Input for listing sub-diseases of a disease."""

    disease_id: int = 0
    include_inactive: bool = False


class ListSubDiseasesUseCase:
    """Lists sub-diseases for a given disease."""

    def __init__(self, disease_repo: DiseaseRepository) -> None:
        self._disease_repo = disease_repo

    async def execute(self, query: ListSubDiseasesQuery) -> list[SubDiseaseEntity]:
        """List sub-diseases for a disease.

        Raises:
            NotFoundError: If the parent disease does not exist.
        """
        disease = await self._disease_repo.get_by_id(query.disease_id)
        if disease is None:
            raise NotFoundError("Disease not found")

        return await self._disease_repo.list_sub_diseases(
            query.disease_id, include_inactive=query.include_inactive
        )

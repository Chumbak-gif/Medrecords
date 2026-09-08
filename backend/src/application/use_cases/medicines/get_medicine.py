"""Get Medicine use case — retrieve a single medicine by ID."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.medicine import MedicineEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.medicine_repository import MedicineRepository


@dataclass
class GetMedicineQuery:
    """Input for retrieving a medicine by ID."""

    medicine_id: int = 0


class GetMedicineUseCase:
    """Retrieves a medicine by ID."""

    def __init__(self, medicine_repo: MedicineRepository) -> None:
        self._medicine_repo = medicine_repo

    async def execute(self, query: GetMedicineQuery) -> MedicineEntity:
        """Retrieve a medicine by ID.

        Raises:
            NotFoundError: If the medicine does not exist.
        """
        medicine = await self._medicine_repo.get_by_id(query.medicine_id)
        if medicine is None:
            raise NotFoundError("Medicine not found")
        return medicine

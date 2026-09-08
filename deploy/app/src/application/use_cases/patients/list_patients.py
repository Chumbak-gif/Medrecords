"""List Patients use case — pagination, search, doctor-scoping via AccessControlService."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.patient import PatientEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.patient_repository import PatientRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ListPatientsQuery:
    """Input parameters for listing patients."""

    page: int = 1
    page_size: int = 20
    search: str = ""
    actor: Optional[UserEntity] = None


@dataclass
class PaginatedResult:
    """Paginated result container."""

    items: list[PatientEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListPatientsUseCase:
    """Lists patients with pagination, search, and doctor-scoping."""

    def __init__(
        self,
        patient_repo: PatientRepository,
        access_control: AccessControlService,
    ) -> None:
        self._patient_repo = patient_repo
        self._access_control = access_control

    async def execute(self, query: ListPatientsQuery) -> PaginatedResult:
        """Retrieve a paginated list of patients, scoped to the actor's permissions."""
        doctor_id = self._access_control.get_doctor_scope_id(query.actor)

        offset = (query.page - 1) * query.page_size

        patients = await self._patient_repo.list(
            offset=offset,
            limit=query.page_size,
            doctor_id=doctor_id,
            search=query.search,
        )

        total = await self._patient_repo.count(
            doctor_id=doctor_id,
            search=query.search,
        )

        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=patients,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

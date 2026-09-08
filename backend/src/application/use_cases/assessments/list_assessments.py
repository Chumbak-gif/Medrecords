"""List Assessments use case — pagination, filters, doctor-scoping."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ListAssessmentsQuery:
    """Input parameters for listing assessments."""

    page: int = 1
    page_size: int = 20
    patient_id: Optional[int] = None
    disease_id: Optional[int] = None
    status: Optional[str] = None
    actor: Optional[UserEntity] = None


@dataclass
class PaginatedResult:
    """Paginated result container for assessments."""

    items: list[AssessmentEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListAssessmentsUseCase:
    """Lists assessments with pagination, filtering, and doctor-scoping."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        access_control: AccessControlService,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._access_control = access_control

    async def execute(self, query: ListAssessmentsQuery) -> PaginatedResult:
        """Retrieve a paginated list of assessments, scoped to actor's permissions."""
        doctor_id = self._access_control.get_doctor_scope_id(query.actor)

        offset = (query.page - 1) * query.page_size

        assessments = await self._assessment_repo.list(
            offset=offset,
            limit=query.page_size,
            patient_id=query.patient_id,
            doctor_id=doctor_id,
            status=query.status,
        )

        total = await self._assessment_repo.count(
            patient_id=query.patient_id,
            doctor_id=doctor_id,
            status=query.status,
        )

        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=assessments,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

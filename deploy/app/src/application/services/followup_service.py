"""FollowupService — consolidated business logic for followup management."""

from dataclasses import dataclass, field
from datetime import date as date_type
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.followup import FollowupEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.followup_repository import IFollowupRepository
from src.domain.repositories.patient_repository import IPatientRepository

# Valid state transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["completed", "cancelled"],
    "completed": [],
    "cancelled": [],
}


@dataclass
class PaginatedResult:
    """Paginated result container for followups."""

    items: list[FollowupEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


@dataclass
class DashboardResult:
    """Dashboard data: pending count + today's followups."""

    pending_count: int = 0
    today_followups: list[FollowupEntity] = field(default_factory=list)


class FollowupService:
    """Consolidated service for followup operations."""

    def __init__(
        self,
        followup_repo: IFollowupRepository,
        patient_repo: IPatientRepository,
        assessment_repo: IAssessmentRepository,
        uow: UnitOfWork,
    ) -> None:
        self._followup_repo = followup_repo
        self._patient_repo = patient_repo
        self._assessment_repo = assessment_repo
        self._uow = uow

    async def list_followups(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        patient_id: Optional[int] = None,
        actor: UserEntity,
    ) -> PaginatedResult:
        """List followups scoped to the current doctor."""
        offset = (page - 1) * page_size

        followups = await self._followup_repo.list(
            offset=offset,
            limit=page_size,
            doctor_id=actor.id,
            patient_id=patient_id,
            status=status,
        )
        total = await self._followup_repo.count(
            doctor_id=actor.id, patient_id=patient_id, status=status
        )
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=followups, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_followup(self, *, followup_id: int, actor: UserEntity) -> FollowupEntity:
        """Retrieve a followup by ID (doctor-scoped).

        Raises:
            ValueError: If followup not found or actor lacks access.
        """
        followup = await self._followup_repo.get_by_id(followup_id)
        if followup is None:
            raise ValueError("Follow-up not found")
        if followup.doctor_id != actor.id:
            raise ValueError("You do not have permission to access this follow-up")
        return followup

    async def create_followup(
        self,
        *,
        patient_id: int,
        assessment_id: Optional[int] = None,
        scheduled_date: Optional[date_type] = None,
        notes: Optional[str] = None,
        actor: UserEntity,
    ) -> FollowupEntity:
        """Create a new followup in pending status.

        Raises:
            ValueError: If patient or assessment not found.
        """
        async with self._uow:
            patient = await self._patient_repo.get_by_id(patient_id)
            if patient is None:
                raise ValueError("Patient not found")

            if assessment_id is not None:
                assessment = await self._assessment_repo.get_by_id(assessment_id)
                if assessment is None:
                    raise ValueError("Assessment not found")

            followup = FollowupEntity(
                patient_id=patient_id,
                doctor_id=actor.id,
                assessment_id=assessment_id,
                scheduled_date=scheduled_date,
                notes=notes,
                status="pending",
            )
            followup = await self._followup_repo.add(followup)
            await self._uow.commit()
            return followup

    async def update_followup(
        self,
        *,
        followup_id: int,
        status: Optional[str] = None,
        scheduled_date: Optional[date_type] = None,
        notes: Optional[str] = None,
        actor: UserEntity,
    ) -> FollowupEntity:
        """Update a followup with state machine enforcement.

        Raises:
            ValueError: If followup not found, actor lacks access, or invalid transition.
        """
        async with self._uow:
            followup = await self._followup_repo.get_by_id(followup_id)
            if followup is None:
                raise ValueError("Follow-up not found")

            if followup.doctor_id != actor.id:
                raise ValueError("You do not have permission to access this follow-up")

            if status is not None and status != followup.status:
                allowed = VALID_TRANSITIONS.get(followup.status, [])
                if status not in allowed:
                    raise ValueError(
                        f"Cannot transition from '{followup.status}' to '{status}'. "
                        f"Allowed transitions: {allowed or 'none'}"
                    )
                followup.status = status

            if scheduled_date is not None:
                followup.scheduled_date = scheduled_date

            if notes is not None:
                followup.notes = notes

            followup = await self._followup_repo.update(followup)
            await self._uow.commit()
            return followup

    async def get_dashboard(self, *, actor: UserEntity) -> DashboardResult:
        """Retrieve followup dashboard data for the current doctor."""
        doctor_id = actor.id

        pending_count = await self._followup_repo.count(doctor_id=doctor_id, status="pending")

        today = date_type.today()
        today_followups = await self._followup_repo.list(
            offset=0,
            limit=1000,
            doctor_id=doctor_id,
            status="pending",
            scheduled_from=today,
            scheduled_to=today,
        )

        return DashboardResult(pending_count=pending_count, today_followups=today_followups)

    async def list_calendar_followups(
        self, *, start_date: date_type, end_date: date_type, actor: UserEntity
    ) -> list[FollowupEntity]:
        """List followups for the calendar view within a date range.

        Raises:
            ValueError: If the date range is invalid.
        """
        if end_date < start_date:
            raise ValueError("end_date must be greater than or equal to start_date")

        delta = (end_date - start_date).days
        if delta > 42:
            raise ValueError("Date range must not exceed 42 days")

        return await self._followup_repo.list(
            offset=0,
            limit=10000,
            doctor_id=actor.id,
            scheduled_from=start_date,
            scheduled_to=end_date,
        )

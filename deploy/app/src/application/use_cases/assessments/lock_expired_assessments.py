"""Lock Expired Assessments use case — transition submitted → locked based on time window."""

from datetime import datetime, timezone

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.repositories.assessment_repository import AssessmentRepository


class LockExpiredAssessmentsUseCase:
    """Transitions submitted assessments to locked when their lock window expires."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        uow: UnitOfWork,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._uow = uow

    async def execute(self) -> int:
        """Lock all submitted assessments whose lock_expires_at <= now.

        Returns:
            Number of assessments transitioned to locked status.
        """
        async with self._uow:
            now = datetime.now(tz=timezone.utc)
            expired = await self._assessment_repo.list_expired_for_locking(now)

            for assessment in expired:
                assessment.status = "locked"
                assessment.locked_at = now
                await self._assessment_repo.update(assessment)

            await self._uow.commit()
            return len(expired)

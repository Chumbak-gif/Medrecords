"""Update Assessment use case — update form_data, handle status transitions."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.config_repository import ConfigRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class UpdateAssessmentCommand:
    """Input data for updating an assessment."""

    assessment_id: int = 0
    form_data: Optional[dict[str, Any]] = None
    consent_given: Optional[bool] = None
    actor: Optional[UserEntity] = None


@dataclass
class SubmitAssessmentCommand:
    """Input data for submitting a draft assessment (draft → submitted)."""

    assessment_id: int = 0
    actor: Optional[UserEntity] = None


class UpdateAssessmentUseCase:
    """Updates an assessment's form_data and/or consent, handling status transitions."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        audit_repo: AuditLogRepository,
        config_repo: ConfigRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._audit_repo = audit_repo
        self._config_repo = config_repo
        self._access_control = access_control
        self._uow = uow

    async def _get_lock_window_hours(self) -> int:
        """Read lock_window_hours from config; default to 24."""
        config = await self._config_repo.get_by_key("lock_window_hours")
        if config is None:
            return 24
        try:
            return int(config.config_value)
        except (ValueError, TypeError):
            return 24

    async def execute(self, command: UpdateAssessmentCommand) -> AssessmentEntity:
        """Update a draft or re-submit within the lock window.

        Raises:
            NotFoundError: If the assessment does not exist.
            ForbiddenError: If the actor cannot access this assessment.
            ConflictError: If the assessment is locked or lock window has expired.
        """
        async with self._uow:
            assessment = await self._assessment_repo.get_by_id(command.assessment_id)
            if assessment is None:
                raise NotFoundError("Assessment not found")

            # Doctor-scoping: doctors can only modify their own
            if not self._access_control.is_privileged(command.actor):
                if assessment.doctor_id != command.actor.id:
                    raise ForbiddenError(
                        "You do not have permission to access this assessment"
                    )

            if assessment.status == "locked":
                raise ConflictError("Assessment is locked and cannot be modified")

            now = datetime.now(tz=timezone.utc)

            if assessment.status == "draft":
                if command.form_data is not None:
                    assessment.form_data = command.form_data
                    assessment.draft_saved_at = now
                if command.consent_given is not None:
                    assessment.consent_given = command.consent_given

            elif assessment.status == "submitted":
                # Allow re-submit only within lock window
                if assessment.lock_expires_at is not None:
                    lock_expires = assessment.lock_expires_at
                    if lock_expires.tzinfo is None:
                        lock_expires = lock_expires.replace(tzinfo=timezone.utc)
                    if now > lock_expires:
                        raise ConflictError(
                            "Assessment lock window has expired; it is now read-only"
                        )
                if command.form_data is not None:
                    assessment.form_data = command.form_data
                    lock_window_hours = await self._get_lock_window_hours()
                    assessment.submitted_at = now
                    assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)
                if command.consent_given is not None:
                    assessment.consent_given = command.consent_given

            assessment = await self._assessment_repo.update(assessment)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=f"Assessment id={command.assessment_id} updated (status={assessment.status})",
                )
            )

            await self._uow.commit()
            return assessment

    async def submit(self, command: SubmitAssessmentCommand) -> AssessmentEntity:
        """Submit a draft assessment (draft → submitted).

        Raises:
            NotFoundError: If the assessment does not exist.
            ForbiddenError: If the actor cannot access this assessment.
            ConflictError: If the assessment is not in draft status.
            ValidationError: If consent has not been given.
        """
        async with self._uow:
            assessment = await self._assessment_repo.get_by_id(command.assessment_id)
            if assessment is None:
                raise NotFoundError("Assessment not found")

            # Doctor-scoping
            if not self._access_control.is_privileged(command.actor):
                if assessment.doctor_id != command.actor.id:
                    raise ForbiddenError(
                        "You do not have permission to access this assessment"
                    )

            if assessment.status != "draft":
                raise ConflictError(
                    f"Assessment is already '{assessment.status}'; only drafts can be submitted"
                )

            if not assessment.consent_given:
                raise ValidationError(
                    "Patient consent must be given before submitting the assessment"
                )

            lock_window_hours = await self._get_lock_window_hours()
            now = datetime.now(tz=timezone.utc)
            assessment.status = "submitted"
            assessment.submitted_at = now
            assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)

            assessment = await self._assessment_repo.update(assessment)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_submitted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=(
                        f"Assessment id={command.assessment_id} submitted; "
                        f"lock_expires_at={assessment.lock_expires_at.isoformat()}"
                    ),
                )
            )

            await self._uow.commit()
            return assessment

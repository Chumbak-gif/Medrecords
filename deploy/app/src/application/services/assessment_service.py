"""AssessmentService — consolidated business logic for assessment management."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.config_repository import IConfigRepository
from src.domain.repositories.template_repository import ITemplateRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for assessments."""

    items: list[AssessmentEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class AssessmentService:
    """Consolidated service for assessment management operations."""

    def __init__(
        self,
        assessment_repo: IAssessmentRepository,
        template_repo: ITemplateRepository,
        config_repo: IConfigRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._template_repo = template_repo
        self._config_repo = config_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def _get_lock_window_hours(self) -> int:
        config = await self._config_repo.get_by_key("lock_window_hours")
        if config is None:
            return 24
        try:
            return int(config.config_value)
        except (ValueError, TypeError):
            return 24

    async def list_assessments(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
        actor: UserEntity,
    ) -> PaginatedResult:
        """List assessments with pagination, filtering, and doctor-scoping."""
        doctor_id = self._access_control.get_doctor_scope_id(actor)
        offset = (page - 1) * page_size

        assessments = await self._assessment_repo.list(
            offset=offset, limit=page_size, patient_id=patient_id, doctor_id=doctor_id, status=status
        )
        total = await self._assessment_repo.count(
            patient_id=patient_id, doctor_id=doctor_id, status=status
        )
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=assessments, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def get_assessment(self, *, assessment_id: int, actor: UserEntity) -> AssessmentEntity:
        """Retrieve an assessment by ID with doctor-scoping.

        Raises:
            ValueError: If assessment not found or actor lacks access.
        """
        assessment = await self._assessment_repo.get_by_id(assessment_id)
        if assessment is None:
            raise ValueError("Assessment not found")

        if not self._access_control.is_privileged(actor):
            if assessment.doctor_id != actor.id:
                raise ValueError("You do not have permission to access this assessment")

        return assessment

    async def create_assessment(
        self,
        *,
        patient_id: int,
        disease_id: int,
        sub_disease_id: Optional[int] = None,
        template_id: int,
        actor: UserEntity,
    ) -> AssessmentEntity:
        """Create a new draft assessment.

        Raises:
            ValueError: If template not found or inactive.
        """
        async with self._uow:
            template = await self._template_repo.get_by_id(template_id)
            if template is None or not template.is_active:
                raise ValueError(f"Active form template with id={template_id} not found")

            assessment = AssessmentEntity(
                patient_id=patient_id,
                disease_id=disease_id,
                sub_disease_id=sub_disease_id,
                template_id=template_id,
                template_snapshot=dict(template.schema),
                form_data={},
                status="draft",
                consent_given=False,
                doctor_id=actor.id,
            )
            assessment = await self._assessment_repo.add(assessment)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=(
                        f"Assessment created for patient_id={patient_id}, "
                        f"disease_id={disease_id}, template_id={template_id}"
                    ),
                )
            )
            await self._uow.commit()
            return assessment

    async def update_assessment(
        self,
        *,
        assessment_id: int,
        form_data: Optional[dict[str, Any]] = None,
        consent_given: Optional[bool] = None,
        actor: UserEntity,
    ) -> AssessmentEntity:
        """Update a draft or re-submit within the lock window.

        Raises:
            ValueError: If assessment not found, actor lacks access, or assessment is locked.
        """
        async with self._uow:
            assessment = await self._assessment_repo.get_by_id(assessment_id)
            if assessment is None:
                raise ValueError("Assessment not found")

            if not self._access_control.is_privileged(actor):
                if assessment.doctor_id != actor.id:
                    raise ValueError("You do not have permission to access this assessment")

            if assessment.status == "locked":
                raise ValueError("Assessment is locked and cannot be modified")

            now = datetime.now(tz=timezone.utc)

            if assessment.status == "draft":
                if form_data is not None:
                    assessment.form_data = form_data
                    assessment.draft_saved_at = now
                if consent_given is not None:
                    assessment.consent_given = consent_given
            elif assessment.status == "submitted":
                if assessment.lock_expires_at is not None:
                    lock_expires = assessment.lock_expires_at
                    if lock_expires.tzinfo is None:
                        lock_expires = lock_expires.replace(tzinfo=timezone.utc)
                    if now > lock_expires:
                        raise ValueError("Assessment lock window has expired; it is now read-only")
                if form_data is not None:
                    assessment.form_data = form_data
                    lock_window_hours = await self._get_lock_window_hours()
                    assessment.submitted_at = now
                    assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)
                if consent_given is not None:
                    assessment.consent_given = consent_given

            assessment = await self._assessment_repo.update(assessment)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=f"Assessment id={assessment_id} updated (status={assessment.status})",
                )
            )
            await self._uow.commit()
            return assessment

    async def submit_assessment(self, *, assessment_id: int, actor: UserEntity) -> AssessmentEntity:
        """Submit a draft assessment (draft → submitted).

        Raises:
            ValueError: If assessment not found, not draft, no consent, or actor lacks access.
        """
        async with self._uow:
            assessment = await self._assessment_repo.get_by_id(assessment_id)
            if assessment is None:
                raise ValueError("Assessment not found")

            if not self._access_control.is_privileged(actor):
                if assessment.doctor_id != actor.id:
                    raise ValueError("You do not have permission to access this assessment")

            if assessment.status != "draft":
                raise ValueError(
                    f"Assessment is already '{assessment.status}'; only drafts can be submitted"
                )

            if not assessment.consent_given:
                raise ValueError("Patient consent must be given before submitting the assessment")

            lock_window_hours = await self._get_lock_window_hours()
            now = datetime.now(tz=timezone.utc)
            assessment.status = "submitted"
            assessment.submitted_at = now
            assessment.lock_expires_at = now + timedelta(hours=lock_window_hours)

            assessment = await self._assessment_repo.update(assessment)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="assessment_submitted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="assessment",
                    entity_id=assessment.id,
                    description=(
                        f"Assessment id={assessment_id} submitted; "
                        f"lock_expires_at={assessment.lock_expires_at.isoformat()}"
                    ),
                )
            )
            await self._uow.commit()
            return assessment

    async def lock_expired_assessments(self) -> int:
        """Lock all submitted assessments whose lock window has expired."""
        async with self._uow:
            now = datetime.now(tz=timezone.utc)
            expired = await self._assessment_repo.list_expired_for_locking(now)

            for assessment in expired:
                assessment.status = "locked"
                assessment.locked_at = now
                await self._assessment_repo.update(assessment)

            await self._uow.commit()
            return len(expired)

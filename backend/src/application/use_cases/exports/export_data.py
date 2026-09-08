"""Export Data use case — generate export payloads for client-side XLSX/PDF."""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Optional

from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError, NotFoundError
from src.domain.repositories.assessment_repository import AssessmentRepository
from src.domain.repositories.audit_log_repository import AuditLogRepository


@dataclass
class ExportAssessmentsQuery:
    """Input for exporting assessment data."""

    month: Optional[int] = None
    year: Optional[int] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    actor: Optional[UserEntity] = None


@dataclass
class ExportAuditQuery:
    """Input for exporting audit log data."""

    from_date: Optional[date] = None
    to_date: Optional[date] = None
    event_type: Optional[str] = None
    actor: Optional[UserEntity] = None


@dataclass
class ExportPdfQuery:
    """Input for exporting a single assessment as PDF data."""

    assessment_id: int = 0
    actor: Optional[UserEntity] = None


class ExportDataUseCase:
    """Generates export payloads for assessments and audit logs."""

    def __init__(
        self,
        assessment_repo: AssessmentRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._audit_repo = audit_repo

    async def export_assessments(self, query: ExportAssessmentsQuery) -> list[dict[str, Any]]:
        """Export assessment data (doctor-scoped or admin full access)."""
        # Determine doctor scope
        doctor_id: Optional[int] = None
        if query.actor.role == "doctor":
            doctor_id = query.actor.id

        # Build date filters
        from_dt: Optional[datetime] = None
        to_dt: Optional[datetime] = None

        if doctor_id is not None:
            # Doctor: filter by month/year
            if query.month is not None and query.year is not None:
                from_dt = datetime(query.year, query.month, 1, tzinfo=timezone.utc)
                if query.month == 12:
                    to_dt = datetime(query.year + 1, 1, 1, tzinfo=timezone.utc)
                else:
                    to_dt = datetime(query.year, query.month + 1, 1, tzinfo=timezone.utc)
        else:
            # Admin: filter by from_date/to_date
            if query.from_date is not None:
                from_dt = datetime(
                    query.from_date.year, query.from_date.month, query.from_date.day,
                    tzinfo=timezone.utc,
                )
            if query.to_date is not None:
                to_dt = datetime(
                    query.to_date.year, query.to_date.month, query.to_date.day,
                    23, 59, 59, tzinfo=timezone.utc,
                )

        return await self._assessment_repo.export_assessments_with_details(
            doctor_id=doctor_id,
            from_date=from_dt,
            to_date=to_dt,
        )

    async def export_assessment_pdf(self, query: ExportPdfQuery) -> dict[str, Any]:
        """Export a single assessment for PDF generation.

        Raises:
            NotFoundError: If the assessment does not exist.
            ForbiddenError: If doctor cannot access the assessment.
        """
        data = await self._assessment_repo.get_assessment_pdf_data(query.assessment_id)
        if data is None:
            raise NotFoundError("Assessment not found")

        # Doctor can only export their own assessments
        if query.actor.role == "doctor" and data["assessment"]["doctor_id"] != query.actor.id:
            raise ForbiddenError("You do not have permission to access this assessment")

        return data

    async def export_audit(self, query: ExportAuditQuery) -> list[dict[str, Any]]:
        """Export audit log data (admin/sys_admin only)."""
        logs = await self._audit_repo.list(
            offset=0,
            limit=100000,
            event_type=query.event_type,
            from_date=query.from_date,
            to_date=query.to_date,
        )

        return [
            {
                "id": log.id,
                "event_type": log.event_type,
                "actor_username": log.actor_username,
                "actor_role": log.actor_role,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "description": log.description,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]

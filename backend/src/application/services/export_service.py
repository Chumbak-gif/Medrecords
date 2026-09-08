"""ExportService — consolidated business logic for data exports."""

from datetime import date, datetime, timezone
from typing import Any, Optional

from src.domain.entities.user import UserEntity
from src.domain.repositories.assessment_repository import IAssessmentRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository


class ExportService:
    """Consolidated service for export operations."""

    def __init__(
        self,
        assessment_repo: IAssessmentRepository,
        audit_repo: IAuditLogRepository,
    ) -> None:
        self._assessment_repo = assessment_repo
        self._audit_repo = audit_repo

    async def export_assessments(
        self,
        *,
        month: Optional[int] = None,
        year: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        actor: UserEntity,
    ) -> list[dict[str, Any]]:
        """Export assessment data (doctor-scoped or admin full access)."""
        doctor_id: Optional[int] = None
        if actor.role == "doctor":
            doctor_id = actor.id

        from_dt: Optional[datetime] = None
        to_dt: Optional[datetime] = None

        if doctor_id is not None:
            if month is not None and year is not None:
                from_dt = datetime(year, month, 1, tzinfo=timezone.utc)
                if month == 12:
                    to_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                else:
                    to_dt = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        else:
            if from_date is not None:
                from_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
            if to_date is not None:
                to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)

        return await self._assessment_repo.export_assessments_with_details(
            doctor_id=doctor_id, from_date=from_dt, to_date=to_dt
        )

    async def export_assessment_pdf(
        self, *, assessment_id: int, actor: UserEntity
    ) -> dict[str, Any]:
        """Export a single assessment for PDF generation.

        Raises:
            ValueError: If assessment not found or actor lacks access.
        """
        data = await self._assessment_repo.get_assessment_pdf_data(assessment_id)
        if data is None:
            raise ValueError("Assessment not found")

        if actor.role == "doctor" and data["assessment"]["doctor_id"] != actor.id:
            raise ValueError("You do not have permission to access this assessment")

        return data

    async def export_audit(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        event_type: Optional[str] = None,
        actor: UserEntity,
    ) -> list[dict[str, Any]]:
        """Export audit log data (admin/sys_admin only)."""
        logs = await self._audit_repo.list(
            offset=0,
            limit=100000,
            event_type=event_type,
            from_date=from_date,
            to_date=to_date,
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

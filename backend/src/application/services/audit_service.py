"""AuditService — consolidated business logic for audit log operations."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for audit logs."""

    items: list[AuditLogEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditService:
    """Consolidated service for audit log operations."""

    def __init__(
        self,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def list_audit_logs(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        event_type: Optional[str] = None,
        actor_username: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        actor: UserEntity,
    ) -> PaginatedResult:
        """List audit logs with pagination and filters (admin/sys_admin only).

        Raises:
            ValueError: If the actor lacks permission.
        """
        try:
            self._access_control.assert_can_view_audit_logs(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        offset = (page - 1) * page_size

        logs = await self._audit_repo.list(
            offset=offset,
            limit=page_size,
            event_type=event_type,
            actor_username=actor_username,
            from_date=from_date,
            to_date=to_date,
        )
        total = await self._audit_repo.count(
            event_type=event_type,
            actor_username=actor_username,
            from_date=from_date,
            to_date=to_date,
        )
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=logs, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    async def create_audit_log(
        self,
        *,
        event_type: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
        actor: UserEntity,
    ) -> AuditLogEntity:
        """Create a new audit log entry (any authenticated user)."""
        async with self._uow:
            entry = AuditLogEntity(
                event_type=event_type,
                actor_id=actor.id,
                actor_username=actor.username,
                actor_role=actor.role,
                entity_type=entity_type,
                entity_id=entity_id,
                description=description,
                ip_address=ip_address,
            )
            entry = await self._audit_repo.add(entry)
            await self._uow.commit()
            return entry

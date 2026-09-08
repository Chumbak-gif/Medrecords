"""List Audit Logs use case — paginated listing with filters (admin only)."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ListAuditLogsQuery:
    """Input parameters for listing audit logs."""

    page: int = 1
    page_size: int = 20
    event_type: Optional[str] = None
    actor_username: Optional[str] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    actor: Optional[UserEntity] = None


@dataclass
class PaginatedResult:
    """Paginated result container for audit logs."""

    items: list[AuditLogEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListAuditLogsUseCase:
    """Lists audit logs with pagination and filters (admin/sys_admin only)."""

    def __init__(
        self,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
    ) -> None:
        self._audit_repo = audit_repo
        self._access_control = access_control

    async def execute(self, query: ListAuditLogsQuery) -> PaginatedResult:
        """Retrieve paginated audit logs.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
        """
        self._access_control.assert_can_view_audit_logs(query.actor)

        offset = (query.page - 1) * query.page_size

        logs = await self._audit_repo.list(
            offset=offset,
            limit=query.page_size,
            event_type=query.event_type,
            actor_username=query.actor_username,
            from_date=query.from_date,
            to_date=query.to_date,
        )

        total = await self._audit_repo.count(
            event_type=query.event_type,
            actor_username=query.actor_username,
            from_date=query.from_date,
            to_date=query.to_date,
        )

        total_pages = max(1, (total + query.page_size - 1) // query.page_size)

        return PaginatedResult(
            items=logs,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
        )

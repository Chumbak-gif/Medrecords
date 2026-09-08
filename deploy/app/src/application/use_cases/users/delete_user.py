"""Delete User use case — soft-delete (deactivate) a user (sys_admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, DomainError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class DeleteUserCommand:
    """Input data for soft-deleting a user."""

    user_id: int = 0
    actor: Optional[UserEntity] = None


class DeleteUserUseCase:
    """Soft-deletes a user by setting is_active=False (sys_admin only)."""

    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        uow: UnitOfWork,
    ) -> None:
        self._user_repo = user_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._uow = uow

    async def execute(self, command: DeleteUserCommand) -> None:
        """Soft-delete a user.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the user does not exist.
            ConflictError: If the user is already inactive.
            DomainError: If trying to deactivate own account.
        """
        self._access_control.assert_can_manage_users(command.actor)

        async with self._uow:
            user = await self._user_repo.get_by_id(command.user_id)
            if user is None:
                raise NotFoundError("User not found")

            if not user.is_active:
                raise ConflictError("User is already inactive")

            if user.id == command.actor.id:
                raise DomainError("You cannot deactivate your own account")

            user.is_active = False
            await self._user_repo.update(user)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_deleted",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' soft-deleted",
                )
            )

            await self._uow.commit()

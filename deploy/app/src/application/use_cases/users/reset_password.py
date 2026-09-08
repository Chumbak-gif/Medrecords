"""Reset Password use case — admin resets another user's password, audit log."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class ResetPasswordCommand:
    """Input data for resetting a user's password."""

    user_id: int = 0
    new_password: str = ""
    actor: Optional[UserEntity] = None


class PasswordHasher:
    """Protocol for password hashing (injected dependency)."""

    def hash(self, password: str) -> str:
        raise NotImplementedError


class ResetPasswordUseCase:
    """Resets a user's password (admin/sys_admin only)."""

    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditLogRepository,
        access_control: AccessControlService,
        password_hasher: PasswordHasher,
        uow: UnitOfWork,
    ) -> None:
        self._user_repo = user_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._password_hasher = password_hasher
        self._uow = uow

    async def execute(self, command: ResetPasswordCommand) -> None:
        """Reset a user's password.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the user does not exist.
        """
        self._access_control.assert_can_manage_users(command.actor)

        async with self._uow:
            user = await self._user_repo.get_by_id(command.user_id)
            if user is None:
                raise NotFoundError("User not found")

            user.hashed_password = self._password_hasher.hash(command.new_password)
            await self._user_repo.update(user)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_password_reset",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"Password reset for user '{user.username}'",
                )
            )

            await self._uow.commit()

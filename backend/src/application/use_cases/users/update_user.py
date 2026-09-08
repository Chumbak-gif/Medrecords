"""Update User use case — update fields (not password), audit log (admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError, NotFoundError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class UpdateUserCommand:
    """Input data for updating a user."""

    user_id: int = 0
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    is_active: Optional[bool] = None
    actor: Optional[UserEntity] = None


class UpdateUserUseCase:
    """Updates user profile fields (not password) with admin access control."""

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

    async def execute(self, command: UpdateUserCommand) -> UserEntity:
        """Update user fields.

        Raises:
            ForbiddenError: If the actor is not admin/sys_admin.
            NotFoundError: If the user does not exist.
            ConflictError: If the new email is already taken.
        """
        self._access_control.assert_can_manage_users(command.actor)

        async with self._uow:
            user = await self._user_repo.get_by_id(command.user_id)
            if user is None:
                raise NotFoundError("User not found")

            # Check email uniqueness if changing
            if command.email is not None and command.email != user.email:
                existing = await self._user_repo.get_by_email(command.email)
                if existing is not None and existing.id != command.user_id:
                    raise ConflictError("A user with this email already exists")
                user.email = command.email

            if command.full_name is not None:
                user.full_name = command.full_name
            if command.role is not None:
                user.role = command.role
            if command.specialty is not None:
                user.specialty = command.specialty
            if command.is_active is not None:
                user.is_active = command.is_active

            user = await self._user_repo.update(user)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_updated",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' updated",
                )
            )

            await self._uow.commit()
            return user

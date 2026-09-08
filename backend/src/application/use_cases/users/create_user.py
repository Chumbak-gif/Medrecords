"""Create User use case — uniqueness check, password hashing, audit log (sys_admin only)."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ConflictError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.user_repository import UserRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class CreateUserCommand:
    """Input data for creating a new user."""

    username: str = ""
    email: str = ""
    full_name: str = ""
    password: str = ""
    role: str = ""
    specialty: Optional[str] = None
    actor: Optional[UserEntity] = None


class PasswordHasher:
    """Protocol for password hashing (injected dependency)."""

    def hash(self, password: str) -> str:
        raise NotImplementedError


class CreateUserUseCase:
    """Creates a new user account (sys_admin only)."""

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

    async def execute(self, command: CreateUserCommand) -> UserEntity:
        """Create a new user.

        Raises:
            ForbiddenError: If the actor is not sys_admin.
            ConflictError: If username or email already exists.
        """
        self._access_control.assert_can_manage_users(command.actor)

        async with self._uow:
            # Check uniqueness by username
            existing_username = await self._user_repo.get_by_username(command.username)
            if existing_username is not None:
                raise ConflictError(
                    "A user with this username or email already exists"
                )

            # Check uniqueness by email
            existing_email = await self._user_repo.get_by_email(command.email)
            if existing_email is not None:
                raise ConflictError(
                    "A user with this username or email already exists"
                )

            user = UserEntity(
                username=command.username,
                email=command.email,
                full_name=command.full_name,
                hashed_password=self._password_hasher.hash(command.password),
                role=command.role,
                specialty=command.specialty,
                is_active=True,
            )
            user = await self._user_repo.add(user)

            # Audit log
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_created",
                    actor_id=command.actor.id,
                    actor_username=command.actor.username,
                    actor_role=command.actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' (role={user.role}) created by sys_admin",
                )
            )

            await self._uow.commit()
            return user

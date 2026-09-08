"""Login use case — verify username/password, generate JWT token."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.exceptions import ValidationError
from src.domain.repositories.audit_log_repository import AuditLogRepository
from src.domain.repositories.user_repository import UserRepository


@dataclass
class LoginCommand:
    """Input data for user login."""

    username: str = ""
    password: str = ""
    ip_address: Optional[str] = None


@dataclass
class LoginResult:
    """Output of a successful login."""

    access_token: str = ""
    token_type: str = "bearer"
    role: str = ""
    user_id: int = 0
    full_name: str = ""


class PasswordHasher:
    """Protocol for password hashing/verification (injected dependency)."""

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        raise NotImplementedError

    def hash(self, password: str) -> str:
        raise NotImplementedError


class TokenService:
    """Protocol for JWT token creation (injected dependency)."""

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        raise NotImplementedError


class LoginUseCase:
    """Authenticates a user and issues a JWT access token."""

    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditLogRepository,
        password_hasher: PasswordHasher,
        token_service: TokenService,
        uow: UnitOfWork,
    ) -> None:
        self._user_repo = user_repo
        self._audit_repo = audit_repo
        self._password_hasher = password_hasher
        self._token_service = token_service
        self._uow = uow

    async def execute(self, command: LoginCommand) -> LoginResult:
        """Verify credentials and return JWT token.

        Raises:
            ValidationError: If credentials are invalid or account is inactive.
        """
        if not command.username or not command.password:
            raise ValidationError("username and password are required")

        async with self._uow:
            user = await self._user_repo.get_by_username(command.username)

            # Invalid credentials
            if user is None or not self._password_hasher.verify(
                command.password, user.hashed_password
            ):
                await self._audit_repo.add(
                    AuditLogEntity(
                        event_type="user_login_failure",
                        actor_username=command.username,
                        actor_role="unknown",
                        description="Invalid credentials",
                        ip_address=command.ip_address,
                    )
                )
                await self._uow.commit()
                raise ValidationError("Invalid credentials")

            # Inactive account
            if not user.is_active:
                await self._audit_repo.add(
                    AuditLogEntity(
                        event_type="user_login_failure",
                        actor_id=user.id,
                        actor_username=command.username,
                        actor_role=user.role,
                        description="Inactive account login attempt",
                        ip_address=command.ip_address,
                    )
                )
                await self._uow.commit()
                raise ValidationError("Invalid credentials")

            # Issue token
            access_token = self._token_service.create_access_token(
                data={"sub": user.username, "role": user.role}
            )

            # Audit success
            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_login",
                    actor_id=user.id,
                    actor_username=user.username,
                    actor_role=user.role,
                    description="Successful login",
                    ip_address=command.ip_address,
                )
            )

            await self._uow.commit()

            return LoginResult(
                access_token=access_token,
                token_type="bearer",
                role=user.role,
                user_id=user.id,
                full_name=user.full_name,
            )

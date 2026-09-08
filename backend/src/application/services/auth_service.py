"""AuthService — consolidated business logic for authentication."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.repositories.user_repository import IUserRepository


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


class AuthService:
    """Consolidated service for authentication operations."""

    def __init__(
        self,
        user_repo: IUserRepository,
        audit_repo: IAuditLogRepository,
        password_hasher: PasswordHasher,
        token_service: TokenService,
        uow: UnitOfWork,
    ) -> None:
        self._user_repo = user_repo
        self._audit_repo = audit_repo
        self._password_hasher = password_hasher
        self._token_service = token_service
        self._uow = uow

    async def login(
        self, *, username: str, password: str, ip_address: Optional[str] = None
    ) -> LoginResult:
        """Verify credentials and return JWT token.

        Raises:
            ValueError: If credentials are invalid or account is inactive.
        """
        if not username or not password:
            raise ValueError("username and password are required")

        async with self._uow:
            user = await self._user_repo.get_by_username(username)

            if user is None or not self._password_hasher.verify(password, user.hashed_password):
                await self._audit_repo.add(
                    AuditLogEntity(
                        event_type="user_login_failure",
                        actor_username=username,
                        actor_role="unknown",
                        description="Invalid credentials",
                        ip_address=ip_address,
                    )
                )
                await self._uow.commit()
                raise ValueError("Invalid credentials")

            if not user.is_active:
                await self._audit_repo.add(
                    AuditLogEntity(
                        event_type="user_login_failure",
                        actor_id=user.id,
                        actor_username=username,
                        actor_role=user.role,
                        description="Inactive account login attempt",
                        ip_address=ip_address,
                    )
                )
                await self._uow.commit()
                raise ValueError("Invalid credentials")

            access_token = self._token_service.create_access_token(
                data={"sub": user.username, "role": user.role}
            )

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_login",
                    actor_id=user.id,
                    actor_username=user.username,
                    actor_role=user.role,
                    description="Successful login",
                    ip_address=ip_address,
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

    async def get_current_user(self, *, username: str) -> UserEntity:
        """Resolve a user entity from a decoded token subject.

        Raises:
            ValueError: If the user is not found or inactive.
        """
        user = await self._user_repo.get_by_username(username)
        if user is None or not user.is_active:
            raise ValueError("Could not validate credentials")
        return user

"""UserService — consolidated business logic for user management."""

from dataclasses import dataclass
from typing import Optional

from src.application.interfaces.unit_of_work import UnitOfWork
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.user import UserEntity
from src.domain.repositories.user_repository import IUserRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository
from src.domain.services.access_control import AccessControlService


@dataclass
class PaginatedResult:
    """Paginated result container for users."""

    items: list[UserEntity]
    total: int
    page: int
    page_size: int
    total_pages: int


class PasswordHasher:
    """Protocol for password hashing (injected dependency)."""

    def hash(self, password: str) -> str:
        raise NotImplementedError

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        raise NotImplementedError


class UserService:
    """Consolidated service for user management operations."""

    def __init__(
        self,
        user_repo: IUserRepository,
        audit_repo: IAuditLogRepository,
        access_control: AccessControlService,
        password_hasher: PasswordHasher,
        uow: UnitOfWork,
    ) -> None:
        self._user_repo = user_repo
        self._audit_repo = audit_repo
        self._access_control = access_control
        self._password_hasher = password_hasher
        self._uow = uow

    async def list_users(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str = "",
        role: Optional[str] = None,
        actor: UserEntity,
    ) -> PaginatedResult:
        """List users with pagination and filtering (admin/sys_admin only).

        Raises:
            ValueError: If the actor lacks permission.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        offset = (page - 1) * page_size

        users = await self._user_repo.list(
            offset=offset,
            limit=page_size,
            search=search,
            role=role,
        )

        total = await self._user_repo.count(search=search, role=role)
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedResult(
            items=users,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_user(self, *, user_id: int, actor: UserEntity) -> UserEntity:
        """Retrieve a user by ID (admin/sys_admin only).

        Raises:
            ValueError: If the actor lacks permission or user not found.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        user = await self._user_repo.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")
        return user

    async def create_user(
        self,
        *,
        username: str,
        email: str,
        full_name: str,
        password: str,
        role: str,
        specialty: Optional[str] = None,
        actor: UserEntity,
    ) -> UserEntity:
        """Create a new user (sys_admin only).

        Raises:
            ValueError: If the actor lacks permission, or username/email already exists.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            existing_username = await self._user_repo.get_by_username(username)
            if existing_username is not None:
                raise ValueError("A user with this username or email already exists")

            existing_email = await self._user_repo.get_by_email(email)
            if existing_email is not None:
                raise ValueError("A user with this username or email already exists")

            user = UserEntity(
                username=username,
                email=email,
                full_name=full_name,
                hashed_password=self._password_hasher.hash(password),
                role=role,
                specialty=specialty,
                is_active=True,
            )
            user = await self._user_repo.add(user)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_created",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' (role={user.role}) created by sys_admin",
                )
            )

            await self._uow.commit()
            return user

    async def update_user(
        self,
        *,
        user_id: int,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        role: Optional[str] = None,
        specialty: Optional[str] = None,
        is_active: Optional[bool] = None,
        actor: UserEntity,
    ) -> UserEntity:
        """Update user fields (not password) with admin access control.

        Raises:
            ValueError: If the actor lacks permission, user not found, or email conflict.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            user = await self._user_repo.get_by_id(user_id)
            if user is None:
                raise ValueError("User not found")

            if email is not None and email != user.email:
                existing = await self._user_repo.get_by_email(email)
                if existing is not None and existing.id != user_id:
                    raise ValueError("A user with this email already exists")
                user.email = email

            if full_name is not None:
                user.full_name = full_name
            if role is not None:
                user.role = role
            if specialty is not None:
                user.specialty = specialty
            if is_active is not None:
                user.is_active = is_active

            user = await self._user_repo.update(user)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_updated",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' updated",
                )
            )

            await self._uow.commit()
            return user

    async def delete_user(self, *, user_id: int, actor: UserEntity) -> None:
        """Soft-delete a user (sys_admin only).

        Raises:
            ValueError: If the actor lacks permission, user not found, already inactive, or self-delete.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            user = await self._user_repo.get_by_id(user_id)
            if user is None:
                raise ValueError("User not found")

            if not user.is_active:
                raise ValueError("User is already inactive")

            if user.id == actor.id:
                raise ValueError("You cannot deactivate your own account")

            user.is_active = False
            await self._user_repo.update(user)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_deleted",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"User '{user.username}' soft-deleted",
                )
            )

            await self._uow.commit()

    async def reset_password(
        self, *, user_id: int, new_password: str, actor: UserEntity
    ) -> None:
        """Reset a user's password (admin/sys_admin only).

        Raises:
            ValueError: If the actor lacks permission or user not found.
        """
        try:
            self._access_control.assert_can_manage_users(actor)
        except Exception as e:
            raise ValueError(str(e)) from e

        async with self._uow:
            user = await self._user_repo.get_by_id(user_id)
            if user is None:
                raise ValueError("User not found")

            user.hashed_password = self._password_hasher.hash(new_password)
            await self._user_repo.update(user)

            await self._audit_repo.add(
                AuditLogEntity(
                    event_type="user_password_reset",
                    actor_id=actor.id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    entity_type="user",
                    entity_id=user.id,
                    description=f"Password reset for user '{user.username}'",
                )
            )

            await self._uow.commit()

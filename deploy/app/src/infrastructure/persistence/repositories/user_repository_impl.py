"""SQLAlchemy implementation of UserRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.user import UserEntity
from src.domain.repositories.user_repository import UserRepository
from src.infrastructure.persistence.models.user_model import UserModel


class SqlAlchemyUserRepository(UserRepository):
    """Concrete user repository backed by SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_entity(model: UserModel) -> UserEntity:
        return UserEntity(
            id=model.id,
            username=model.username,
            email=model.email,
            full_name=model.full_name,
            hashed_password=model.hashed_password,
            role=model.role,
            specialty=model.specialty,
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_model(entity: UserEntity) -> UserModel:
        return UserModel(
            id=entity.id,
            username=entity.username,
            email=entity.email,
            full_name=entity.full_name,
            hashed_password=entity.hashed_password,
            role=entity.role,
            specialty=entity.specialty,
            is_active=entity.is_active,
        )

    # ------------------------------------------------------------------
    # Internal query builder
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_filters(stmt, *, search: str = "", role: Optional[str] = None, is_active: Optional[bool] = None):
        """Apply common filter predicates to a SELECT statement."""
        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                or_(
                    UserModel.username.ilike(like),
                    UserModel.email.ilike(like),
                    UserModel.full_name.ilike(like),
                )
            )
        if role is not None:
            stmt = stmt.where(UserModel.role == role)
        if is_active is not None:
            stmt = stmt.where(UserModel.is_active == is_active)
        return stmt

    # ------------------------------------------------------------------
    # Repository interface methods
    # ------------------------------------------------------------------

    async def get_by_id(self, user_id: int) -> Optional[UserEntity]:
        result = await self._session.get(UserModel, user_id)
        return self._to_entity(result) if result else None

    async def get_by_username(self, username: str) -> Optional[UserEntity]:
        stmt = select(UserModel).where(UserModel.username == username)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_email(self, email: str) -> Optional[UserEntity]:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
        search: str = "",
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[UserEntity]:
        stmt = select(UserModel)
        stmt = self._apply_filters(stmt, search=search, role=role, is_active=is_active)
        stmt = stmt.order_by(UserModel.created_at.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return [self._to_entity(row) for row in result.scalars().all()]

    async def count(
        self,
        *,
        search: str = "",
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        stmt = select(func.count(UserModel.id))
        stmt = self._apply_filters(stmt, search=search, role=role, is_active=is_active)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def add(self, user: UserEntity) -> UserEntity:
        model = self._to_model(user)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def update(self, user: UserEntity) -> UserEntity:
        model = await self._session.get(UserModel, user.id)
        if model is None:
            raise ValueError(f"User with id={user.id} not found")
        model.username = user.username
        model.email = user.email
        model.full_name = user.full_name
        model.hashed_password = user.hashed_password
        model.role = user.role
        model.specialty = user.specialty
        model.is_active = user.is_active
        await self._session.flush()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def delete(self, user_id: int) -> None:
        model = await self._session.get(UserModel, user_id)
        if model:
            await self._session.delete(model)
            await self._session.flush()

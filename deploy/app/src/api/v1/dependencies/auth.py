"""JWT authentication dependency — mirrors current app/dependencies/auth.py behavior exactly.

Uses HS256, same secret_key, same bearer token scheme, same error responses.
"""

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.dependencies.container import get_db
from src.config.settings import get_settings
from src.infrastructure.persistence.models.user_model import UserModel

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserModel:
    """Extract and validate the Bearer JWT token from the Authorization header.

    Raises HTTP 401 if the token is missing, invalid, expired, or the user
    is not found / inactive.
    """
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(UserModel).where(UserModel.username == username))
    user: UserModel | None = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


def role_required(roles: list[str]) -> Callable:
    """Dependency factory that checks whether the current user holds one of the permitted roles.

    Raises HTTP 403 otherwise.
    """

    async def _check_role(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return _check_role

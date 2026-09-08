"""JWT token service implementation."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt

from src.application.use_cases.auth.login import TokenService
from src.config.settings import get_settings


class JwtTokenService(TokenService):
    """Concrete implementation using python-jose with HS256."""

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        settings = get_settings()
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + (
            expires_delta if expires_delta else timedelta(minutes=settings.access_token_expire_minutes)
        )
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

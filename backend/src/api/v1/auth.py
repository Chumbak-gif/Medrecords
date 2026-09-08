"""Auth router — login, me, logout endpoints.

Preserves exact same behavior as app/routers/auth.py.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.v1.dependencies.auth import get_current_user
from src.api.v1.dependencies.container import get_db
from src.api.v1.schemas.auth import TokenResponse, UserProfile
from src.config.settings import get_settings
from src.infrastructure.persistence.models.audit_log_model import AuditLogModel
from src.infrastructure.persistence.models.user_model import UserModel

router = APIRouter(tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def _write_audit_log(
    db: AsyncSession,
    *,
    event_type: str,
    actor_username: str,
    actor_role: str,
    actor_id: Optional[int] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    log_entry = AuditLogModel(
        event_type=event_type,
        actor_id=actor_id,
        actor_username=actor_username,
        actor_role=actor_role,
        description=description,
        ip_address=ip_address,
    )
    db.add(log_entry)


# ---------------------------------------------------------------------------
# POST /login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse, summary="Obtain a JWT access token")
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    resolved_username: Optional[str] = None
    resolved_password: Optional[str] = None

    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            raw = await request.json()
            resolved_username = raw.get("username")
            resolved_password = raw.get("password")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            resolved_username = form.get("username")
            resolved_password = form.get("password")
        except Exception:
            pass

    if not resolved_username or not resolved_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username and password are required",
        )

    ip_address: Optional[str] = request.client.host if request.client else None

    result = await db.execute(select(UserModel).where(UserModel.username == resolved_username))
    user: Optional[UserModel] = result.scalar_one_or_none()

    if user is None or not _verify_password(resolved_password, user.hashed_password):
        await _write_audit_log(
            db,
            event_type="user_login_failure",
            actor_username=resolved_username,
            actor_role="unknown",
            description="Invalid credentials",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        await _write_audit_log(
            db,
            event_type="user_login_failure",
            actor_username=resolved_username,
            actor_role=user.role,
            actor_id=user.id,
            description="Inactive account login attempt",
            ip_address=ip_address,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = _create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    await _write_audit_log(
        db,
        event_type="user_login",
        actor_username=user.username,
        actor_role=user.role,
        actor_id=user.id,
        description="Successful login",
        ip_address=ip_address,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name,
    )


# ---------------------------------------------------------------------------
# GET /me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserProfile, summary="Get current user profile")
async def get_me(current_user: UserModel = Depends(get_current_user)) -> UserProfile:
    return UserProfile.model_validate(current_user)


# ---------------------------------------------------------------------------
# POST /logout
# ---------------------------------------------------------------------------

@router.post("/logout", summary="Log out (audit entry only — token discard is client-side)")
async def logout(
    request: Request,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ip_address: Optional[str] = request.client.host if request.client else None

    await _write_audit_log(
        db,
        event_type="user_logout",
        actor_username=current_user.username,
        actor_role=current_user.role,
        actor_id=current_user.id,
        description="User logged out",
        ip_address=ip_address,
    )

    return {"message": "Logged out successfully"}

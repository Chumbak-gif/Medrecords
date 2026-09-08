from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    specialty: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}

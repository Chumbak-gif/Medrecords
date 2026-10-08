"""User domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class UserEntity:
    """Framework-agnostic representation of a User."""

    id: Optional[int] = None
    username: str = ""
    email: str = ""
    full_name: str = ""
    hashed_password: str = ""
    role: str = ""
    specialty: Optional[str] = None
    is_active: bool = True
    must_change_password: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

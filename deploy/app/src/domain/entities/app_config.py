"""AppConfig domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class AppConfigEntity:
    """Framework-agnostic representation of an Application Configuration entry."""

    id: Optional[int] = None
    config_key: str = ""
    config_value: str = ""
    updated_by: Optional[int] = None
    updated_at: Optional[datetime] = None

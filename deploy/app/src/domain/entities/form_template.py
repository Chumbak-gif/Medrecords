"""FormTemplate domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class FormTemplateEntity:
    """Framework-agnostic representation of a Form Template."""

    id: Optional[int] = None
    disease_id: int = 0
    version: int = 1
    schema: dict[str, Any] = None  # type: ignore[assignment]
    is_active: bool = True
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self) -> None:
        if self.schema is None:
            self.schema = {}

"""Medicine domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class MedicineEntity:
    """Framework-agnostic representation of a Medicine."""

    id: Optional[int] = None
    name: str = ""
    brand_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

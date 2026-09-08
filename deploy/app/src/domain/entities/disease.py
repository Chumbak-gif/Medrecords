"""Disease and SubDisease domain entities."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class DiseaseEntity:
    """Framework-agnostic representation of a Disease."""

    id: Optional[int] = None
    name: str = ""
    description: Optional[str] = None
    is_active: bool = True
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class SubDiseaseEntity:
    """Framework-agnostic representation of a SubDisease."""

    id: Optional[int] = None
    disease_id: int = 0
    name: str = ""
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

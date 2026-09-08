"""AuditLog domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class AuditLogEntity:
    """Framework-agnostic representation of an Audit Log entry."""

    id: Optional[int] = None
    event_type: str = ""
    actor_id: Optional[int] = None
    actor_username: str = ""
    actor_role: str = ""
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

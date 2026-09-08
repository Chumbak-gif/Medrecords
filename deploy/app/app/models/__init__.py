# Re-export all ORM models so they are registered with SQLAlchemy's
# metadata and can be discovered by Alembic via `Base.metadata`.

from app.models.app_config import AppConfig
from app.models.assessment import Assessment
from app.models.audit_log import AuditLog
from app.models.consent_record import ConsentRecord
from app.models.disease import Disease, SubDisease
from app.models.followup import Followup
from app.models.form_template import FormTemplate
from app.models.medicine import Medicine
from app.models.patient import Patient
from app.models.prescription_row import PrescriptionRow
from app.models.user import User

__all__ = [
    "User",
    "Disease",
    "SubDisease",
    "FormTemplate",
    "Medicine",
    "Patient",
    "Assessment",
    "PrescriptionRow",
    "ConsentRecord",
    "AuditLog",
    "AppConfig",
    "Followup",
]

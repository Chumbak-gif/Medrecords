"""Domain entities — framework-agnostic dataclasses representing business concepts."""

from src.domain.entities.patient import PatientEntity
from src.domain.entities.assessment import AssessmentEntity
from src.domain.entities.user import UserEntity
from src.domain.entities.audit_log import AuditLogEntity
from src.domain.entities.disease import DiseaseEntity, SubDiseaseEntity
from src.domain.entities.medicine import MedicineEntity
from src.domain.entities.prescription_row import PrescriptionRowEntity
from src.domain.entities.followup import FollowupEntity
from src.domain.entities.form_template import FormTemplateEntity
from src.domain.entities.app_config import AppConfigEntity
from src.domain.entities.consent_record import ConsentRecordEntity

__all__ = [
    "PatientEntity",
    "AssessmentEntity",
    "UserEntity",
    "AuditLogEntity",
    "DiseaseEntity",
    "SubDiseaseEntity",
    "MedicineEntity",
    "PrescriptionRowEntity",
    "FollowupEntity",
    "FormTemplateEntity",
    "AppConfigEntity",
    "ConsentRecordEntity",
]

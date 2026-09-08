"""Domain repository interfaces (ports) — abstract contracts for data access."""

from src.domain.repositories.patient_repository import IPatientRepository, PatientRepository
from src.domain.repositories.assessment_repository import IAssessmentRepository, AssessmentRepository
from src.domain.repositories.user_repository import IUserRepository, UserRepository
from src.domain.repositories.audit_log_repository import IAuditLogRepository, AuditLogRepository
from src.domain.repositories.disease_repository import IDiseaseRepository, DiseaseRepository
from src.domain.repositories.medicine_repository import IMedicineRepository, MedicineRepository
from src.domain.repositories.prescription_repository import IPrescriptionRepository, PrescriptionRepository
from src.domain.repositories.followup_repository import IFollowupRepository, FollowupRepository
from src.domain.repositories.template_repository import ITemplateRepository, TemplateRepository
from src.domain.repositories.config_repository import IConfigRepository, ConfigRepository

__all__ = [
    "IPatientRepository",
    "IAssessmentRepository",
    "IUserRepository",
    "IAuditLogRepository",
    "IDiseaseRepository",
    "IMedicineRepository",
    "IPrescriptionRepository",
    "IFollowupRepository",
    "ITemplateRepository",
    "IConfigRepository",
    # Backward-compatible aliases
    "PatientRepository",
    "AssessmentRepository",
    "UserRepository",
    "AuditLogRepository",
    "DiseaseRepository",
    "MedicineRepository",
    "PrescriptionRepository",
    "FollowupRepository",
    "TemplateRepository",
    "ConfigRepository",
]

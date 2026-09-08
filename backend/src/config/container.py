"""Simple class-based DI container — wires repositories and use cases.

No third-party DI library required. Each factory method creates the full
dependency chain for a given use case using the provided session.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.infrastructure.persistence.repositories.patient_repository_impl import SqlAlchemyPatientRepository
from src.infrastructure.persistence.repositories.assessment_repository_impl import SqlAlchemyAssessmentRepository
from src.infrastructure.persistence.repositories.user_repository_impl import SqlAlchemyUserRepository
from src.infrastructure.persistence.repositories.audit_log_repository_impl import SqlAlchemyAuditLogRepository
from src.infrastructure.persistence.repositories.disease_repository_impl import SqlAlchemyDiseaseRepository
from src.infrastructure.persistence.repositories.medicine_repository_impl import SqlAlchemyMedicineRepository
from src.infrastructure.persistence.repositories.prescription_repository_impl import SqlAlchemyPrescriptionRepository
from src.infrastructure.persistence.repositories.followup_repository_impl import SqlAlchemyFollowupRepository
from src.infrastructure.persistence.repositories.template_repository_impl import SqlAlchemyTemplateRepository
from src.infrastructure.persistence.repositories.config_repository_impl import SqlAlchemyConfigRepository
from src.infrastructure.persistence.uid_generator import SqlAlchemyPatientUidGenerator
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from src.domain.services.access_control import AccessControlService

# Use cases — patients
from src.application.use_cases.patients.register_patient import RegisterPatientUseCase
from src.application.use_cases.patients.list_patients import ListPatientsUseCase
from src.application.use_cases.patients.get_patient import GetPatientUseCase
from src.application.use_cases.patients.update_patient import UpdatePatientUseCase
from src.application.use_cases.patients.delete_patient import DeletePatientUseCase

# Use cases — assessments
from src.application.use_cases.assessments.create_assessment import CreateAssessmentUseCase
from src.application.use_cases.assessments.list_assessments import ListAssessmentsUseCase
from src.application.use_cases.assessments.get_assessment import GetAssessmentUseCase
from src.application.use_cases.assessments.update_assessment import UpdateAssessmentUseCase
from src.application.use_cases.assessments.lock_expired_assessments import LockExpiredAssessmentsUseCase

# Use cases — auth
from src.application.use_cases.auth.login import LoginUseCase
from src.application.use_cases.auth.get_current_user import GetCurrentUserUseCase

# Use cases — prescriptions
from src.application.use_cases.prescriptions.list_prescriptions import ListPrescriptionsUseCase
from src.application.use_cases.prescriptions.create_prescription import CreatePrescriptionUseCase

# Use cases — analytics
from src.application.use_cases.analytics.get_analytics import GetAnalyticsUseCase

# Use cases — exports
from src.application.use_cases.exports.export_data import ExportDataUseCase

# Use cases — audit
from src.application.use_cases.audit.list_audit_logs import ListAuditLogsUseCase
from src.application.use_cases.audit.create_audit_log import CreateAuditLogUseCase

# Use cases — config
from src.application.use_cases.config.get_config import GetConfigUseCase
from src.application.use_cases.config.update_config import UpdateConfigUseCase

# Use cases — users
from src.application.use_cases.users.list_users import ListUsersUseCase
from src.application.use_cases.users.get_user import GetUserUseCase
from src.application.use_cases.users.create_user import CreateUserUseCase
from src.application.use_cases.users.update_user import UpdateUserUseCase
from src.application.use_cases.users.delete_user import DeleteUserUseCase
from src.application.use_cases.users.reset_password import ResetPasswordUseCase

# Use cases — diseases
from src.application.use_cases.diseases.list_diseases import ListDiseasesUseCase
from src.application.use_cases.diseases.create_disease import CreateDiseaseUseCase
from src.application.use_cases.diseases.get_disease import GetDiseaseUseCase
from src.application.use_cases.diseases.update_disease import UpdateDiseaseUseCase
from src.application.use_cases.diseases.delete_disease import DeleteDiseaseUseCase
from src.application.use_cases.diseases.restore_disease import RestoreDiseaseUseCase
from src.application.use_cases.diseases.list_sub_diseases import ListSubDiseasesUseCase
from src.application.use_cases.diseases.create_sub_disease import CreateSubDiseaseUseCase
from src.application.use_cases.diseases.update_sub_disease import UpdateSubDiseaseUseCase
from src.application.use_cases.diseases.delete_sub_disease import DeleteSubDiseaseUseCase

# Use cases — medicines
from src.application.use_cases.medicines.list_medicines import ListMedicinesUseCase
from src.application.use_cases.medicines.create_medicine import CreateMedicineUseCase
from src.application.use_cases.medicines.get_medicine import GetMedicineUseCase
from src.application.use_cases.medicines.update_medicine import UpdateMedicineUseCase
from src.application.use_cases.medicines.delete_medicine import DeleteMedicineUseCase
from src.application.use_cases.medicines.import_medicines import ImportMedicinesUseCase

# Use cases — templates
from src.application.use_cases.templates.list_templates import ListTemplatesUseCase
from src.application.use_cases.templates.create_template import CreateTemplateUseCase
from src.application.use_cases.templates.get_template import GetTemplateUseCase
from src.application.use_cases.templates.update_template import UpdateTemplateUseCase
from src.application.use_cases.templates.delete_template import DeleteTemplateUseCase

# Use cases — followups
from src.application.use_cases.followups.list_followups import ListFollowupsUseCase
from src.application.use_cases.followups.create_followup import CreateFollowupUseCase
from src.application.use_cases.followups.update_followup import UpdateFollowupUseCase
from src.application.use_cases.followups.get_followup import GetFollowupUseCase
from src.application.use_cases.followups.get_dashboard import GetFollowupDashboardUseCase
from src.application.use_cases.followups.list_calendar import ListCalendarFollowupsUseCase


class Container:
    """Lightweight DI container that creates use cases with the full dependency chain.

    Usage in FastAPI dependencies:
        container = Container(session_factory)
        use_case = container.get_register_patient_use_case(session)
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    # ── Unit of Work ─────────────────────────────────────────────────────────

    def _uow(self) -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(self._session_factory)

    # ── Repositories (require session) ───────────────────────────────────────

    @staticmethod
    def _patient_repo(session: AsyncSession) -> SqlAlchemyPatientRepository:
        return SqlAlchemyPatientRepository(session)

    @staticmethod
    def _assessment_repo(session: AsyncSession) -> SqlAlchemyAssessmentRepository:
        return SqlAlchemyAssessmentRepository(session)

    @staticmethod
    def _user_repo(session: AsyncSession) -> SqlAlchemyUserRepository:
        return SqlAlchemyUserRepository(session)

    @staticmethod
    def _audit_repo(session: AsyncSession) -> SqlAlchemyAuditLogRepository:
        return SqlAlchemyAuditLogRepository(session)

    @staticmethod
    def _disease_repo(session: AsyncSession) -> SqlAlchemyDiseaseRepository:
        return SqlAlchemyDiseaseRepository(session)

    @staticmethod
    def _medicine_repo(session: AsyncSession) -> SqlAlchemyMedicineRepository:
        return SqlAlchemyMedicineRepository(session)

    @staticmethod
    def _prescription_repo(session: AsyncSession) -> SqlAlchemyPrescriptionRepository:
        return SqlAlchemyPrescriptionRepository(session)

    @staticmethod
    def _followup_repo(session: AsyncSession) -> SqlAlchemyFollowupRepository:
        return SqlAlchemyFollowupRepository(session)

    @staticmethod
    def _template_repo(session: AsyncSession) -> SqlAlchemyTemplateRepository:
        return SqlAlchemyTemplateRepository(session)

    @staticmethod
    def _config_repo(session: AsyncSession) -> SqlAlchemyConfigRepository:
        return SqlAlchemyConfigRepository(session)

    @staticmethod
    def _uid_generator(session: AsyncSession) -> SqlAlchemyPatientUidGenerator:
        return SqlAlchemyPatientUidGenerator(session)

    # ── Patient Use Cases ────────────────────────────────────────────────────

    def get_register_patient_use_case(self, session: AsyncSession) -> RegisterPatientUseCase:
        return RegisterPatientUseCase(
            patient_repo=self._patient_repo(session),
            audit_repo=self._audit_repo(session),
            uid_generator=self._uid_generator(session),
            uow=self._uow(),
        )

    def get_list_patients_use_case(self, session: AsyncSession) -> ListPatientsUseCase:
        return ListPatientsUseCase(
            patient_repo=self._patient_repo(session),
        )

    def get_get_patient_use_case(self, session: AsyncSession) -> GetPatientUseCase:
        return GetPatientUseCase(
            patient_repo=self._patient_repo(session),
            assessment_repo=self._assessment_repo(session),
        )

    def get_update_patient_use_case(self, session: AsyncSession) -> UpdatePatientUseCase:
        return UpdatePatientUseCase(
            patient_repo=self._patient_repo(session),
            audit_repo=self._audit_repo(session),
            assessment_repo=self._assessment_repo(session),
            uow=self._uow(),
        )

    def get_delete_patient_use_case(self, session: AsyncSession) -> DeletePatientUseCase:
        return DeletePatientUseCase(
            patient_repo=self._patient_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Assessment Use Cases ─────────────────────────────────────────────────

    def get_create_assessment_use_case(self, session: AsyncSession) -> CreateAssessmentUseCase:
        return CreateAssessmentUseCase(
            assessment_repo=self._assessment_repo(session),
            template_repo=self._template_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    def get_list_assessments_use_case(self, session: AsyncSession) -> ListAssessmentsUseCase:
        return ListAssessmentsUseCase(
            assessment_repo=self._assessment_repo(session),
        )

    def get_get_assessment_use_case(self, session: AsyncSession) -> GetAssessmentUseCase:
        return GetAssessmentUseCase(
            assessment_repo=self._assessment_repo(session),
        )

    def get_update_assessment_use_case(self, session: AsyncSession) -> UpdateAssessmentUseCase:
        return UpdateAssessmentUseCase(
            assessment_repo=self._assessment_repo(session),
            config_repo=self._config_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    def get_lock_expired_assessments_use_case(self, session: AsyncSession) -> LockExpiredAssessmentsUseCase:
        return LockExpiredAssessmentsUseCase(
            assessment_repo=self._assessment_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Auth Use Cases ───────────────────────────────────────────────────────

    def get_login_use_case(self, session: AsyncSession) -> LoginUseCase:
        from src.infrastructure.persistence.services.password_hasher import BcryptPasswordHasher
        from src.infrastructure.persistence.services.token_service import JwtTokenService

        return LoginUseCase(
            user_repo=self._user_repo(session),
            audit_repo=self._audit_repo(session),
            password_hasher=BcryptPasswordHasher(),
            token_service=JwtTokenService(),
            uow=self._uow(),
        )

    def get_get_current_user_use_case(self, session: AsyncSession) -> GetCurrentUserUseCase:
        return GetCurrentUserUseCase(
            user_repo=self._user_repo(session),
        )

    # ── Prescription Use Cases ───────────────────────────────────────────────

    def get_list_prescriptions_use_case(self, session: AsyncSession) -> ListPrescriptionsUseCase:
        return ListPrescriptionsUseCase(
            prescription_repo=self._prescription_repo(session),
            assessment_repo=self._assessment_repo(session),
        )

    def get_create_prescription_use_case(self, session: AsyncSession) -> CreatePrescriptionUseCase:
        return CreatePrescriptionUseCase(
            prescription_repo=self._prescription_repo(session),
            assessment_repo=self._assessment_repo(session),
            medicine_repo=self._medicine_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Analytics Use Cases ──────────────────────────────────────────────────

    def get_analytics_use_case(self, session: AsyncSession) -> GetAnalyticsUseCase:
        return GetAnalyticsUseCase(
            assessment_repo=self._assessment_repo(session),
            patient_repo=self._patient_repo(session),
            disease_repo=self._disease_repo(session),
            user_repo=self._user_repo(session),
        )

    # ── Export Use Cases ─────────────────────────────────────────────────────

    def get_export_data_use_case(self, session: AsyncSession) -> ExportDataUseCase:
        return ExportDataUseCase(
            assessment_repo=self._assessment_repo(session),
            audit_repo=self._audit_repo(session),
        )

    # ── Audit Use Cases ──────────────────────────────────────────────────────

    def get_list_audit_logs_use_case(self, session: AsyncSession) -> ListAuditLogsUseCase:
        return ListAuditLogsUseCase(
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
        )

    def get_create_audit_log_use_case(self, session: AsyncSession) -> CreateAuditLogUseCase:
        return CreateAuditLogUseCase(
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Config Use Cases ─────────────────────────────────────────────────────

    def get_get_config_use_case(self, session: AsyncSession) -> GetConfigUseCase:
        return GetConfigUseCase(
            config_repo=self._config_repo(session),
        )

    def get_update_config_use_case(self, session: AsyncSession) -> UpdateConfigUseCase:
        return UpdateConfigUseCase(
            config_repo=self._config_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    # ── User Use Cases ───────────────────────────────────────────────────────

    def get_list_users_use_case(self, session: AsyncSession) -> ListUsersUseCase:
        return ListUsersUseCase(
            user_repo=self._user_repo(session),
            access_control=AccessControlService(),
        )

    def get_get_user_use_case(self, session: AsyncSession) -> GetUserUseCase:
        return GetUserUseCase(
            user_repo=self._user_repo(session),
            access_control=AccessControlService(),
        )

    def get_create_user_use_case(self, session: AsyncSession) -> CreateUserUseCase:
        from src.infrastructure.persistence.services.password_hasher import BcryptPasswordHasher

        return CreateUserUseCase(
            user_repo=self._user_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            password_hasher=BcryptPasswordHasher(),
            uow=self._uow(),
        )

    def get_update_user_use_case(self, session: AsyncSession) -> UpdateUserUseCase:
        return UpdateUserUseCase(
            user_repo=self._user_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_delete_user_use_case(self, session: AsyncSession) -> DeleteUserUseCase:
        return DeleteUserUseCase(
            user_repo=self._user_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_reset_password_use_case(self, session: AsyncSession) -> ResetPasswordUseCase:
        from src.infrastructure.persistence.services.password_hasher import BcryptPasswordHasher

        return ResetPasswordUseCase(
            user_repo=self._user_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            password_hasher=BcryptPasswordHasher(),
            uow=self._uow(),
        )

    # ── Disease Use Cases ────────────────────────────────────────────────────

    def get_list_diseases_use_case(self, session: AsyncSession) -> ListDiseasesUseCase:
        return ListDiseasesUseCase(
            disease_repo=self._disease_repo(session),
        )

    def get_create_disease_use_case(self, session: AsyncSession) -> CreateDiseaseUseCase:
        return CreateDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_get_disease_use_case(self, session: AsyncSession) -> GetDiseaseUseCase:
        return GetDiseaseUseCase(
            disease_repo=self._disease_repo(session),
        )

    def get_update_disease_use_case(self, session: AsyncSession) -> UpdateDiseaseUseCase:
        return UpdateDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_delete_disease_use_case(self, session: AsyncSession) -> DeleteDiseaseUseCase:
        return DeleteDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_restore_disease_use_case(self, session: AsyncSession) -> RestoreDiseaseUseCase:
        return RestoreDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_list_sub_diseases_use_case(self, session: AsyncSession) -> ListSubDiseasesUseCase:
        return ListSubDiseasesUseCase(
            disease_repo=self._disease_repo(session),
        )

    def get_create_sub_disease_use_case(self, session: AsyncSession) -> CreateSubDiseaseUseCase:
        return CreateSubDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_update_sub_disease_use_case(self, session: AsyncSession) -> UpdateSubDiseaseUseCase:
        return UpdateSubDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_delete_sub_disease_use_case(self, session: AsyncSession) -> DeleteSubDiseaseUseCase:
        return DeleteSubDiseaseUseCase(
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    # ── Medicine Use Cases ───────────────────────────────────────────────────

    def get_list_medicines_use_case(self, session: AsyncSession) -> ListMedicinesUseCase:
        return ListMedicinesUseCase(
            medicine_repo=self._medicine_repo(session),
        )

    def get_create_medicine_use_case(self, session: AsyncSession) -> CreateMedicineUseCase:
        return CreateMedicineUseCase(
            medicine_repo=self._medicine_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_get_medicine_use_case(self, session: AsyncSession) -> GetMedicineUseCase:
        return GetMedicineUseCase(
            medicine_repo=self._medicine_repo(session),
        )

    def get_update_medicine_use_case(self, session: AsyncSession) -> UpdateMedicineUseCase:
        return UpdateMedicineUseCase(
            medicine_repo=self._medicine_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    def get_delete_medicine_use_case(self, session: AsyncSession) -> DeleteMedicineUseCase:
        return DeleteMedicineUseCase(
            medicine_repo=self._medicine_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    def get_import_medicines_use_case(self, session: AsyncSession) -> ImportMedicinesUseCase:
        return ImportMedicinesUseCase(
            medicine_repo=self._medicine_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Template Use Cases ───────────────────────────────────────────────────

    def get_list_templates_use_case(self, session: AsyncSession) -> ListTemplatesUseCase:
        return ListTemplatesUseCase(
            template_repo=self._template_repo(session),
        )

    def get_create_template_use_case(self, session: AsyncSession) -> CreateTemplateUseCase:
        return CreateTemplateUseCase(
            template_repo=self._template_repo(session),
            disease_repo=self._disease_repo(session),
            audit_repo=self._audit_repo(session),
            access_control=AccessControlService(),
            uow=self._uow(),
        )

    def get_get_template_use_case(self, session: AsyncSession) -> GetTemplateUseCase:
        return GetTemplateUseCase(
            template_repo=self._template_repo(session),
        )

    def get_update_template_use_case(self, session: AsyncSession) -> UpdateTemplateUseCase:
        return UpdateTemplateUseCase(
            template_repo=self._template_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    def get_delete_template_use_case(self, session: AsyncSession) -> DeleteTemplateUseCase:
        return DeleteTemplateUseCase(
            template_repo=self._template_repo(session),
            audit_repo=self._audit_repo(session),
            uow=self._uow(),
        )

    # ── Followup Use Cases ───────────────────────────────────────────────────

    def get_list_followups_use_case(self, session: AsyncSession) -> ListFollowupsUseCase:
        return ListFollowupsUseCase(
            followup_repo=self._followup_repo(session),
        )

    def get_create_followup_use_case(self, session: AsyncSession) -> CreateFollowupUseCase:
        return CreateFollowupUseCase(
            followup_repo=self._followup_repo(session),
            patient_repo=self._patient_repo(session),
            assessment_repo=self._assessment_repo(session),
            uow=self._uow(),
        )

    def get_update_followup_use_case(self, session: AsyncSession) -> UpdateFollowupUseCase:
        return UpdateFollowupUseCase(
            followup_repo=self._followup_repo(session),
            uow=self._uow(),
        )

    def get_get_followup_use_case(self, session: AsyncSession) -> GetFollowupUseCase:
        return GetFollowupUseCase(
            followup_repo=self._followup_repo(session),
        )

    def get_followup_dashboard_use_case(self, session: AsyncSession) -> GetFollowupDashboardUseCase:
        return GetFollowupDashboardUseCase(
            followup_repo=self._followup_repo(session),
        )

    def get_list_calendar_followups_use_case(self, session: AsyncSession) -> ListCalendarFollowupsUseCase:
        return ListCalendarFollowupsUseCase(
            followup_repo=self._followup_repo(session),
        )

"""FastAPI Depends() helpers that provide database sessions and use cases.

These bridge the FastAPI dependency injection system with the application's
Container class. Each endpoint receives a use case instance with the full
dependency chain already wired.
"""

from typing import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.container import Container
from src.infrastructure.persistence.database import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for request-scoped usage, auto-committing on success."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_container() -> Container:
    """Return the application DI container."""
    return Container(session_factory=async_session_factory)


# ── Convenience dependency functions for use cases ───────────────────────────
# These can be used in router Depends() to get use case instances


async def get_register_patient_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_register_patient_use_case(db)


async def get_list_patients_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_patients_use_case(db)


async def get_get_patient_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_patient_use_case(db)


async def get_update_patient_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_patient_use_case(db)


async def get_delete_patient_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_patient_use_case(db)


async def get_login_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_login_use_case(db)


async def get_list_assessments_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_assessments_use_case(db)


async def get_create_assessment_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_assessment_use_case(db)


async def get_get_assessment_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_assessment_use_case(db)


async def get_update_assessment_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_assessment_use_case(db)


async def get_list_prescriptions_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_prescriptions_use_case(db)


async def get_create_prescription_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_prescription_use_case(db)


async def get_analytics_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_analytics_use_case(db)


async def get_export_data_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_export_data_use_case(db)


async def get_list_audit_logs_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_audit_logs_use_case(db)


async def get_get_config_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_config_use_case(db)


async def get_update_config_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_config_use_case(db)


async def get_list_users_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_users_use_case(db)


async def get_get_user_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_user_use_case(db)


async def get_create_user_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_user_use_case(db)


async def get_update_user_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_user_use_case(db)


async def get_delete_user_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_user_use_case(db)


async def get_reset_password_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_reset_password_use_case(db)


async def get_list_diseases_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_diseases_use_case(db)


async def get_create_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_disease_use_case(db)


async def get_get_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_disease_use_case(db)


async def get_update_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_disease_use_case(db)


async def get_delete_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_disease_use_case(db)


async def get_restore_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_restore_disease_use_case(db)


async def get_list_sub_diseases_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_sub_diseases_use_case(db)


async def get_create_sub_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_sub_disease_use_case(db)


async def get_update_sub_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_sub_disease_use_case(db)


async def get_delete_sub_disease_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_sub_disease_use_case(db)


async def get_list_medicines_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_medicines_use_case(db)


async def get_create_medicine_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_medicine_use_case(db)


async def get_get_medicine_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_medicine_use_case(db)


async def get_update_medicine_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_medicine_use_case(db)


async def get_delete_medicine_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_medicine_use_case(db)


async def get_import_medicines_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_import_medicines_use_case(db)


async def get_list_templates_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_templates_use_case(db)


async def get_create_template_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_template_use_case(db)


async def get_get_template_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_template_use_case(db)


async def get_update_template_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_template_use_case(db)


async def get_delete_template_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_delete_template_use_case(db)


async def get_list_followups_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_followups_use_case(db)


async def get_create_followup_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_followup_use_case(db)


async def get_update_followup_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_update_followup_use_case(db)


async def get_get_followup_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_get_followup_use_case(db)


async def get_followup_dashboard_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_followup_dashboard_use_case(db)


async def get_list_calendar_followups_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_list_calendar_followups_use_case(db)


async def get_create_audit_log_use_case(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
):
    return container.get_create_audit_log_use_case(db)

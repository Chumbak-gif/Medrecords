"""Domain service for access control — doctor-scoping and role-based permissions."""

from dataclasses import dataclass
from typing import Optional

from src.domain.entities.user import UserEntity
from src.domain.exceptions import ForbiddenError


# Role constants
ROLE_DOCTOR = "doctor"
ROLE_ADMIN = "admin"
ROLE_SYS_ADMIN = "sys_admin"

# Privileged roles that bypass doctor-scoping
_PRIVILEGED_ROLES = {ROLE_ADMIN, ROLE_SYS_ADMIN}


@dataclass
class AccessControlService:
    """Encapsulates doctor-scoping logic and role-based permission checks.

    Rules:
    - admin and sys_admin roles have full access to all patients/assessments.
    - doctor role can only access patients they registered or assessed.
    - Certain operations (user management, config) are restricted to admin/sys_admin.
    """

    def is_privileged(self, user: UserEntity) -> bool:
        """Check if the user has a privileged (admin/sys_admin) role."""
        return user.role in _PRIVILEGED_ROLES

    def get_doctor_scope_id(self, user: UserEntity) -> Optional[int]:
        """Return the doctor_id to scope queries to, or None for admins.

        Doctors are scoped to their own ID; privileged users see all data.
        """
        if self.is_privileged(user):
            return None
        return user.id

    def assert_can_access_patient(
        self,
        user: UserEntity,
        patient_registered_by: Optional[int],
        doctor_ids_who_assessed: list[int],
    ) -> None:
        """Raise ForbiddenError if a doctor cannot access a specific patient.

        A doctor can access a patient if they registered the patient OR
        have created at least one assessment for the patient.
        """
        if self.is_privileged(user):
            return

        if user.id == patient_registered_by:
            return

        if user.id in doctor_ids_who_assessed:
            return

        raise ForbiddenError("You do not have permission to access this patient.")

    def assert_can_manage_users(self, user: UserEntity) -> None:
        """Only admins and sys_admins can manage user accounts."""
        if not self.is_privileged(user):
            raise ForbiddenError("Only admin or sys_admin can manage users.")

    def assert_can_manage_config(self, user: UserEntity) -> None:
        """Only admins and sys_admins can modify application configuration."""
        if not self.is_privileged(user):
            raise ForbiddenError("Only admin or sys_admin can manage configuration.")

    def assert_can_manage_diseases(self, user: UserEntity) -> None:
        """Only admins and sys_admins can create/update diseases and templates."""
        if not self.is_privileged(user):
            raise ForbiddenError("Only admin or sys_admin can manage diseases.")

    def assert_can_view_audit_logs(self, user: UserEntity) -> None:
        """Only admins and sys_admins can view audit logs."""
        if not self.is_privileged(user):
            raise ForbiddenError("Only admin or sys_admin can view audit logs.")

    def assert_can_export(self, user: UserEntity) -> None:
        """Only admins and sys_admins can perform data exports."""
        if not self.is_privileged(user):
            raise ForbiddenError("Only admin or sys_admin can export data.")

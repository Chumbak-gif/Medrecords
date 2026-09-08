"""Add performance indexes for analytics queries"""

revision = '0004'
down_revision = '0003_followups_table'

from alembic import op


def upgrade():
    # Assessments - most queried table for analytics
    op.create_index('ix_assessments_created_at', 'assessments', ['created_at'])
    op.create_index('ix_assessments_disease_id', 'assessments', ['disease_id'])
    op.create_index('ix_assessments_doctor_id', 'assessments', ['doctor_id'])
    op.create_index('ix_assessments_status', 'assessments', ['status'])
    op.create_index('ix_assessments_patient_id', 'assessments', ['patient_id'])
    # Composite index for common analytics filter pattern
    op.create_index('ix_assessments_disease_created', 'assessments', ['disease_id', 'created_at'])

    # Patients
    op.create_index('ix_patients_registered_by', 'patients', ['registered_by'])
    op.create_index('ix_patients_contact_number', 'patients', ['contact_number'])

    # Followups
    op.create_index('ix_followups_scheduled_date', 'followups', ['scheduled_date'])
    op.create_index('ix_followups_doctor_id', 'followups', ['doctor_id'])

    # Audit logs
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_event_type', 'audit_logs', ['event_type'])


def downgrade():
    op.drop_index('ix_assessments_created_at')
    op.drop_index('ix_assessments_disease_id')
    op.drop_index('ix_assessments_doctor_id')
    op.drop_index('ix_assessments_status')
    op.drop_index('ix_assessments_patient_id')
    op.drop_index('ix_assessments_disease_created')
    op.drop_index('ix_patients_registered_by')
    op.drop_index('ix_patients_contact_number')
    op.drop_index('ix_followups_scheduled_date')
    op.drop_index('ix_followups_doctor_id')
    op.drop_index('ix_audit_logs_created_at')
    op.drop_index('ix_audit_logs_event_type')

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. users
    # -----------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.Text(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("idx_users_username", "users", ["username"])
    op.create_index("idx_users_role", "users", ["role"])
    op.create_index("idx_users_is_active", "users", ["is_active"])

    # -----------------------------------------------------------------------
    # 2. diseases
    # -----------------------------------------------------------------------
    op.create_table(
        "diseases",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_diseases_name"),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_diseases_created_by", ondelete="RESTRICT"
        ),
    )
    op.create_index("idx_diseases_name", "diseases", ["name"])
    op.create_index("idx_diseases_is_active", "diseases", ["is_active"])

    # -----------------------------------------------------------------------
    # 3. sub_diseases
    # -----------------------------------------------------------------------
    op.create_table(
        "sub_diseases",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("disease_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("disease_id", "name", name="uq_sub_diseases_disease_id_name"),
        sa.ForeignKeyConstraint(
            ["disease_id"], ["diseases.id"], name="fk_sub_diseases_disease_id", ondelete="RESTRICT"
        ),
    )
    op.create_index("idx_sub_diseases_disease_id", "sub_diseases", ["disease_id"])
    op.create_index("idx_sub_diseases_is_active", "sub_diseases", ["is_active"])

    # -----------------------------------------------------------------------
    # 4. form_templates
    # -----------------------------------------------------------------------
    op.create_table(
        "form_templates",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("disease_id", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("schema", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["disease_id"],
            ["diseases.id"],
            name="fk_form_templates_disease_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name="fk_form_templates_created_by",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_form_templates_disease_id", "form_templates", ["disease_id"])
    op.create_index("idx_form_templates_is_active", "form_templates", ["is_active"])

    # -----------------------------------------------------------------------
    # 5. medicines
    # -----------------------------------------------------------------------
    op.create_table(
        "medicines",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_medicines_name"),
    )
    op.create_index("idx_medicines_name", "medicines", ["name"])
    op.create_index("idx_medicines_is_active", "medicines", ["is_active"])

    # -----------------------------------------------------------------------
    # 6. patients
    # -----------------------------------------------------------------------
    op.create_table(
        "patients",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_uid", sa.String(20), nullable=False),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("gender", sa.String(20), nullable=False),
        sa.Column("contact_number", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("registered_by", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patient_uid", name="uq_patients_patient_uid"),
        sa.UniqueConstraint("contact_number", name="uq_patients_contact_number"),
        sa.ForeignKeyConstraint(
            ["registered_by"],
            ["users.id"],
            name="fk_patients_registered_by",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_patients_patient_uid", "patients", ["patient_uid"])
    op.create_index("idx_patients_contact_number", "patients", ["contact_number"])
    op.create_index("idx_patients_registered_by", "patients", ["registered_by"])

    # -----------------------------------------------------------------------
    # 7. assessments
    # -----------------------------------------------------------------------
    op.create_table(
        "assessments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=False),
        sa.Column("doctor_id", sa.BigInteger(), nullable=False),
        sa.Column("disease_id", sa.BigInteger(), nullable=False),
        sa.Column("sub_disease_id", sa.BigInteger(), nullable=True),
        sa.Column("template_id", sa.BigInteger(), nullable=False),
        sa.Column("template_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("form_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("consent_given", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("draft_saved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lock_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["patient_id"], ["patients.id"], name="fk_assessments_patient_id", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["doctor_id"], ["users.id"], name="fk_assessments_doctor_id", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["disease_id"],
            ["diseases.id"],
            name="fk_assessments_disease_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["sub_disease_id"],
            ["sub_diseases.id"],
            name="fk_assessments_sub_disease_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["form_templates.id"],
            name="fk_assessments_template_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_assessments_patient_id", "assessments", ["patient_id"])
    op.create_index("idx_assessments_doctor_id", "assessments", ["doctor_id"])
    op.create_index("idx_assessments_disease_id", "assessments", ["disease_id"])
    op.create_index("idx_assessments_status", "assessments", ["status"])
    op.create_index("idx_assessments_submitted_at", "assessments", ["submitted_at"])
    op.create_index("idx_assessments_lock_expires_at", "assessments", ["lock_expires_at"])

    # -----------------------------------------------------------------------
    # 8. prescription_rows
    # -----------------------------------------------------------------------
    op.create_table(
        "prescription_rows",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("assessment_id", sa.BigInteger(), nullable=False),
        sa.Column("medicine_id", sa.BigInteger(), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=False),
        sa.Column("duration", sa.String(100), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["assessment_id"],
            ["assessments.id"],
            name="fk_prescription_rows_assessment_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["medicine_id"],
            ["medicines.id"],
            name="fk_prescription_rows_medicine_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "idx_prescription_rows_assessment_id", "prescription_rows", ["assessment_id"]
    )

    # -----------------------------------------------------------------------
    # 9. consent_records
    # -----------------------------------------------------------------------
    op.create_table(
        "consent_records",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("assessment_id", sa.BigInteger(), nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=False),
        sa.Column("doctor_id", sa.BigInteger(), nullable=False),
        sa.Column("consent_statement_version", sa.String(20), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assessment_id", name="uq_consent_records_assessment_id"),
        sa.ForeignKeyConstraint(
            ["assessment_id"],
            ["assessments.id"],
            name="fk_consent_records_assessment_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name="fk_consent_records_patient_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["doctor_id"],
            ["users.id"],
            name="fk_consent_records_doctor_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_consent_records_assessment_id", "consent_records", ["assessment_id"])
    op.create_index("idx_consent_records_patient_id", "consent_records", ["patient_id"])

    # -----------------------------------------------------------------------
    # 10. audit_logs
    # -----------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("actor_username", sa.String(100), nullable=False),
        sa.Column("actor_role", sa.String(20), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.BigInteger(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name="fk_audit_logs_actor_id",
            ondelete="RESTRICT",
        ),
    )
    op.create_index("idx_audit_logs_event_type", "audit_logs", ["event_type"])
    op.create_index("idx_audit_logs_actor_username", "audit_logs", ["actor_username"])
    op.create_index("idx_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("idx_audit_logs_entity_type", "audit_logs", ["entity_type"])

    # -----------------------------------------------------------------------
    # 11. app_config
    # -----------------------------------------------------------------------
    op.create_table(
        "app_config",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("config_key", sa.String(100), nullable=False),
        sa.Column("config_value", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("config_key", name="uq_app_config_config_key"),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name="fk_app_config_updated_by",
            ondelete="RESTRICT",
        ),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("app_config")
    op.drop_table("audit_logs")
    op.drop_table("consent_records")
    op.drop_table("prescription_rows")
    op.drop_table("assessments")
    op.drop_table("patients")
    op.drop_table("medicines")
    op.drop_table("form_templates")
    op.drop_table("sub_diseases")
    op.drop_table("diseases")
    op.drop_table("users")

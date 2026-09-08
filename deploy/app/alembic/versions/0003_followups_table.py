"""Create followups table

Revision ID: 0003_followups_table
Revises: 0002_medicine_brd_fields
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0003_followups_table"
down_revision = "0002_medicine_brd_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "followups",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.BigInteger, sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("doctor_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("assessment_id", sa.BigInteger, sa.ForeignKey("assessments.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("scheduled_date", sa.Date, nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending', 'completed', 'cancelled')", name="ck_followups_status"),
    )

    op.create_index("idx_followups_patient_id", "followups", ["patient_id"])
    op.create_index("idx_followups_doctor_id", "followups", ["doctor_id"])
    op.create_index("idx_followups_status", "followups", ["status"])
    op.create_index("idx_followups_scheduled_date", "followups", ["scheduled_date"])
    op.create_index("idx_followups_doctor_status_date", "followups", ["doctor_id", "status", "scheduled_date"])


def downgrade() -> None:
    op.drop_table("followups")

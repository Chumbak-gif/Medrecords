"""Add BRD medicine fields: brand_name, generic_name, strength, form, manufacturer

Revision ID: 0002_medicine_brd_fields
Revises: 0001_initial_schema
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_medicine_brd_fields"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new BRD-required fields to medicines table
    with op.batch_alter_table("medicines") as batch_op:
        batch_op.add_column(sa.Column("brand_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("generic_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("strength", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("form", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("manufacturer", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("medicines") as batch_op:
        batch_op.drop_column("manufacturer")
        batch_op.drop_column("form")
        batch_op.drop_column("strength")
        batch_op.drop_column("generic_name")
        batch_op.drop_column("brand_name")

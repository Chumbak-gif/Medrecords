"""Add must_change_password flag to users

Revision ID: 0005_must_change_password
Revises: 0004
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0005_must_change_password"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Existing users already have working passwords — don't force them to
    # change on next login. Only newly created / admin-reset users should be
    # forced (handled explicitly in app code going forward).
    op.execute('UPDATE users SET must_change_password = FALSE')


def downgrade():
    op.drop_column("users", "must_change_password")

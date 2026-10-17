"""court area label

Revision ID: 0002_t10_court_area
Revises: 0001
"""
import sqlalchemy as sa

from alembic import op

revision = "0002_t10_court_area"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("courts", sa.Column("area", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("courts", "area")

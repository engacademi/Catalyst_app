"""Venue photo and its credit line, shown on event tiles and the venue guide."""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("venues", sa.Column("photo_url", sa.String(500), nullable=True))
    op.add_column("venues", sa.Column("photo_credit", sa.String(300), nullable=True))


def downgrade():
    op.drop_column("venues", "photo_credit")
    op.drop_column("venues", "photo_url")

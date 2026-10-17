"""AES sources: event key and failed-check health

Revision ID: 0002_t8_aes_source
Revises: 0002_t14_work_team
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_t8_aes_source"
down_revision: str | None = "0002_t14_work_team"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("external_key", sa.String(length=300), nullable=True))
    op.add_column("sources", sa.Column("unavailable_since", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sources", sa.Column("last_check_error", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("sources", "last_check_error")
    op.drop_column("sources", "unavailable_since")
    op.drop_column("sources", "external_key")

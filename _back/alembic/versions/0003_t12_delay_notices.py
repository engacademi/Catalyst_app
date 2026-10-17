"""delay notices on courts

Revision ID: 0003_t12_delay_notices
Revises: 0002_t8_aes_source
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0003_t12_delay_notices"
down_revision: Union[str, None] = "0002_t8_aes_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delay_notices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("event_id", sa.Uuid(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("court_id", sa.Uuid(), sa.ForeignKey("courts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("posted_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cleared_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_delay_notices_event_id", "delay_notices", ["event_id"])
    op.create_index("ix_delay_notices_court_id", "delay_notices", ["court_id"])


def downgrade() -> None:
    op.drop_table("delay_notices")

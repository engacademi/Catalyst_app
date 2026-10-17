"""demo clock on events

Revision ID: 0002_t7_demo_clock
Revises: 0002_t14_work_team
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002_t7_demo_clock"
down_revision: Union[str, None] = "0002_t14_work_team"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("demo_time", sa.DateTime(timezone=True), nullable=True))
    op.add_column("events", sa.Column("demo_time_set_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "demo_time_set_at")
    op.drop_column("events", "demo_time")

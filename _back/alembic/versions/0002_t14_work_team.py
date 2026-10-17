"""Matches carry an optional work team.

Revision ID: 0002_t14_work_team
Revises: 0001
"""

import sqlalchemy as sa

from alembic import op

revision = "0002_t14_work_team"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("work_entry_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "matches_work_entry_id_fkey", "matches", "event_entries", ["work_entry_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_matches_work_entry", "matches", ["work_entry_id"])


def downgrade() -> None:
    op.drop_index("ix_matches_work_entry", "matches")
    op.drop_constraint("matches_work_entry_id_fkey", "matches", type_="foreignkey")
    op.drop_column("matches", "work_entry_id")

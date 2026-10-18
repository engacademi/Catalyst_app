"""Persist private match score disputes for staff review."""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "score_disputes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "match_id",
            sa.Uuid(),
            sa.ForeignKey("matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reporter_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("comment", sa.String(1000), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("match_id", "reporter_id"),
    )
    op.create_index("ix_score_disputes_match_id", "score_disputes", ["match_id"])


def downgrade():
    op.drop_table("score_disputes")

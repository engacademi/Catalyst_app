"""Aggregate sponsor views and clicks per partner card and placement; no visitor data."""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "partner_engagement",
        sa.Column(
            "partner_id",
            sa.Uuid(),
            sa.ForeignKey("partner_cards.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("placement", sa.String(20), primary_key=True),
        sa.Column(
            "event_id",
            sa.Uuid(),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("views", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_partner_engagement_event_id", "partner_engagement", ["event_id"]
    )


def downgrade():
    op.drop_table("partner_engagement")

"""Account preferences and opt-in player following; no automatic staff grants."""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "account_profiles",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("account_type", sa.String(20), nullable=False),
        sa.Column("officer_type", sa.String(20)),
        sa.Column(
            "team_entry_id",
            sa.Uuid(),
            sa.ForeignKey("event_entries.id", ondelete="SET NULL"),
        ),
        sa.Column("discoverable", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "account_follows",
        sa.Column(
            "follower_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "player_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("follower_id <> player_id", name="no_self_follow"),
    )

    op.create_index("ix_account_follows_player", "account_follows", ["player_id"])


def downgrade():
    op.drop_table("account_follows")
    op.drop_table("account_profiles")

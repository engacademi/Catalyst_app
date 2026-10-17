"""Connector configuration and team-scoped roster review."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("matches", sa.Column("official_time_revised_at", sa.DateTime(timezone=True)))
    op.add_column("events", sa.Column("demo_clock", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.add_column("courts", sa.Column("area_label", sa.String(150)))
    op.add_column("courts", sa.Column("delay", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.add_column("matches", sa.Column("work_entry_id", sa.Uuid(), sa.ForeignKey("event_entries.id", ondelete="SET NULL")))
    op.add_column("sources", sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.add_column("sources", sa.Column("last_attempt_at", sa.DateTime(timezone=True)))
    op.add_column("sources", sa.Column("last_error", sa.String(500)))
    op.add_column("roster_publications", sa.Column("review", postgresql.JSONB(), nullable=False, server_default="{}"))
    op.add_column("role_grants", sa.Column("entry_id", sa.Uuid(), sa.ForeignKey("event_entries.id", ondelete="CASCADE")))

def downgrade():
    op.drop_column("matches", "official_time_revised_at")
    op.drop_column("matches", "work_entry_id")
    op.drop_column("courts", "delay")
    op.drop_column("courts", "area_label")
    op.drop_column("events", "demo_clock")
    op.drop_column("role_grants", "entry_id")
    op.drop_column("roster_publications", "review")
    op.drop_column("sources", "last_error")
    op.drop_column("sources", "last_attempt_at")
    op.drop_column("sources", "config")

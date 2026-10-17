"""Optional public venue coordinates for local event discovery."""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("venues", sa.Column("city", sa.String(150)))
    op.add_column("venues", sa.Column("latitude", sa.Float()))
    op.add_column("venues", sa.Column("longitude", sa.Float()))
    # Only the synthetic fixture gets sample coordinates. Real venues need staff verification.
    op.execute(
        "UPDATE venues SET city = 'Toronto', latitude = 43.6532, longitude = -79.3832 FROM events WHERE venues.event_id = events.id AND events.slug = 'demo-championships' AND events.is_demo = true"
    )


def downgrade():
    op.drop_column("venues", "longitude")
    op.drop_column("venues", "latitude")
    op.drop_column("venues", "city")

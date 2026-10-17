from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
# Any fixed number works; it only has to be the same for every deploy.
MIGRATION_LOCK_ID = 727271


def run_migrations_offline() -> None:
    context.configure(url=get_settings().database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(get_settings().database_url)
    with engine.connect() as connection:
        # An advisory lock stops two deploys from migrating at the same time.
        connection.execute(text("select pg_advisory_lock(:id)"), {"id": MIGRATION_LOCK_ID})
        try:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            connection.execute(text("select pg_advisory_unlock(:id)"), {"id": MIGRATION_LOCK_ID})
            connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

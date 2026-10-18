import os

os.environ.setdefault("TEST_DATABASE_URL", "postgresql+psycopg://postgres@localhost:54329/courtside_test")
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
os.environ["APP_ENV"] = "test"
os.environ["AUTH_MODE"] = "dev"

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.db import get_engine, get_sessionmaker  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    """Migrate a disposable database once; the tests run against real PostgreSQL."""
    with get_engine().begin() as conn:
        conn.execute(text("drop schema public cascade; create schema public"))
    command.upgrade(Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini")), "head")
    yield


@pytest.fixture(autouse=True)
def clean():
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with get_engine().begin() as conn:
        conn.execute(text(f"truncate {tables} restart identity cascade"))


@pytest.fixture(autouse=True)
def waits(monkeypatch):
    """Record the spacing between Nominatim lookups instead of sleeping through it."""
    from app.modules import geocode

    slept = []
    monkeypatch.setattr(geocode, "sleep", slept.append)
    return slept


@pytest.fixture
def db():
    with get_sessionmaker()() as session:
        yield session


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)


@pytest.fixture
def demo(db):
    from app.seed import seed

    return seed(db)


ADMIN = {"X-Dev-User": "dev-admin"}
OFFICIAL = {"X-Dev-User": "dev-official"}

"""Tests never use application tables: all SQL runs in a generated test schema."""
import os
import atexit
import re
import uuid
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from app.core.config import settings

# TEST_DATABASE_URL may point to a dedicated server; otherwise isolate on the configured server.
_base_url = make_url(os.environ.get("TEST_DATABASE_URL", settings.DATABASE_URL))
_schema = "synchain_test_" + uuid.uuid4().hex
_admin = create_engine(
    _base_url,
    connect_args={"connect_timeout": 15},
    pool_pre_ping=True,
    pool_recycle=300,
)
with _admin.begin() as conn:
    conn.execute(text(f'CREATE SCHEMA "{_schema}"'))
def cleanup_schema():
    assert re.fullmatch(r"synchain_test_[0-9a-f]{32}", _schema)
    try:
        with _admin.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{_schema}" CASCADE'))
    except Exception:
        pass
    finally:
        _admin.dispose()
atexit.register(cleanup_schema)
_test_url = _base_url.update_query_dict({"options": f"-csearch_path={_schema}"})
settings.DATABASE_URL = _test_url.render_as_string(hide_password=False)
os.environ["DATABASE_URL"] = settings.DATABASE_URL
# Database module has not yet been loaded by application test modules.
from app.core.database import engine, Base
from app.models.postgres import models, observations
from alembic.config import Config
from alembic import command
_config = Config("alembic.ini")
_config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))
command.upgrade(_config, "head")

@pytest.fixture(autouse=True)
def isolated_tables():
    yield
    with engine.begin() as conn:
        names = ','.join('"'+t.name+'"' for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {names} CASCADE"))

def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    cleanup_schema()
    atexit.unregister(cleanup_schema)

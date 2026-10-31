# ruff: noqa: E402
import os
import tempfile
from pathlib import Path

import pytest

TEST_DATA = tempfile.TemporaryDirectory(prefix="finder-keeper-tests-")
os.environ["DATA_DIR"] = TEST_DATA.name
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATA.name}/test.db"
os.environ["SEED_LIBRARY"] = "false"
os.environ["AUTH_MODE"] = "local"
os.environ["APP_ENV"] = "development"
os.environ["OLLAMA_ENABLED"] = "false"
models = Path(__file__).resolve().parent.parent / ".data" / "models"
if models.exists():
    (Path(TEST_DATA.name) / "models").symlink_to(models, target_is_directory=True)

from fastapi.testclient import TestClient

from app.database import Base, Session, init_db
from app.embeddings import embeddings
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    init_db()
    embeddings.warmup()


@pytest.fixture(autouse=True)
def clean_database(monkeypatch):
    import app.main as main
    from app.jobs import run_job

    monkeypatch.setattr(main, "dispatch", run_job)
    app.dependency_overrides.clear()
    with Session.begin() as session:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app, base_url="http://127.0.0.1", client=("127.0.0.1", 12345))

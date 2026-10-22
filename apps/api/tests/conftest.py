import pytest
from ai.providers.base import LLMProvider, LLMResult
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_provider
from app.core.db import Base, get_db
from app.core.security import ROLE_ADMIN, ROLE_TEACHER, Principal, get_principal
from app.main import create_app
from app.services.curriculum import seed_curriculum


class FakeProvider(LLMProvider):
    """Fournisseur de test uniquement (jamais utilisé dans l'application)."""

    def __init__(self):
        self.calls: list[dict] = []
        self.responses: list = []

    def generate_structured(self, *, system, user, schema, operation):
        self.calls.append({"system": system, "user": user, "operation": operation})
        return LLMResult(parsed=self.responses.pop(0), model="test-model", input_tokens=1000, output_tokens=500)


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    import app.models  # noqa: F401

    Base.metadata.create_all(engine)
    sf = sessionmaker(engine, expire_on_commit=False)
    with sf() as s:
        seed_curriculum(s)
    return sf


@pytest.fixture
def provider():
    return FakeProvider()


@pytest.fixture
def make_client(session_factory, provider):
    def _make(sub="teacher-1", establishment=1, roles=(ROLE_TEACHER,)):
        app = create_app()

        def db():
            with session_factory() as s:
                yield s

        app.dependency_overrides[get_db] = db
        app.dependency_overrides[get_principal] = lambda: Principal(sub, establishment, frozenset(roles))
        app.dependency_overrides[get_provider] = lambda: provider
        return TestClient(app)

    return _make


@pytest.fixture
def client(make_client):
    return make_client()


@pytest.fixture
def other_establishment_client(make_client):
    return make_client(sub="teacher-2", establishment=2)


__all__ = ["ROLE_ADMIN"]

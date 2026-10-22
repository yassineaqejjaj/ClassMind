"""Démo locale de ClassMind, sans Keycloak ni PostgreSQL.

⚠️ Outil de développement : l'authentification est remplacée par un enseignant fixe. Ne jamais l'exposer
sur un réseau. L'IA reste réelle : renseignez OPENAI_API_KEY et OPENAI_MODEL dans `.env` (sinon la
génération répond « Service IA non configuré »).

    python scripts/local_demo.py            # API sur :8765, base SQLite dans .local/
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "apps" / "api"), str(ROOT)]
os.chdir(ROOT)  # pour que `.env` à la racine soit lu
(ROOT / ".local").mkdir(exist_ok=True)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{ROOT / '.local' / 'classmind-demo.db'}")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.db import Base, get_db, get_engine  # noqa: E402
from app.core.security import Principal, get_principal  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import SchoolClass  # noqa: E402
from app.services.curriculum import seed_curriculum  # noqa: E402

PORT = int(os.environ.get("LOCAL_API_PORT", "8765"))
engine = get_engine()
Base.metadata.create_all(engine)
with Session(engine) as s:
    seed_curriculum(s)

app = create_app()


def _db():
    with Session(engine, expire_on_commit=False) as s:
        yield s


app.dependency_overrides[get_db] = _db
app.dependency_overrides[get_principal] = lambda: Principal("camille", 1, frozenset({"teacher"}))
# get_provider n'est PAS remplacé : les appels IA passent par OpenAI si la clé est configurée.

with Session(engine) as s:
    empty = s.scalar(select(SchoolClass.id).limit(1)) is None
if empty:
    c = TestClient(app)
    cid = c.post("/api/classes", json={"name": "5e B", "level": "5e", "school_year": "2026-2027"}).json()["id"]
    d = ROOT / "docs" / "sample-data"
    mapping = (d / "mapping.json").read_text()
    for f, title, day in (
        ("evaluation-1.csv", "Test 1 · Nombres relatifs", "2026-10-09"),
        ("evaluation-2.csv", "Test 2 · Après consolidation", "2026-10-23"),
    ):
        c.post(
            f"/api/classes/{cid}/assessments",
            data={"title": title, "held_on": day, "mapping": mapping},
            files={"file": (f, (d / f).read_bytes(), "text/csv")},
        )
    print("Classe fictive « 5e B » créée avec deux évaluations.")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")

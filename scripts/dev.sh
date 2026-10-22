#!/usr/bin/env sh
# Développement local : API sur :8000 (SQLite possible via DATABASE_URL), web sur :5173.
set -e
cd "$(dirname "$0")/.."
(cd apps/api && uv sync && alembic upgrade head && python -m app.cli seed && uvicorn app.main:app --reload) &
(cd apps/web && npm install && npm run dev)

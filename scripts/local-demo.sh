#!/usr/bin/env sh
# Démo locale : API (SQLite, auth de dev) + frontend. Aucune dépendance à Podman, Keycloak ni PostgreSQL.
# Ports modifiables : LOCAL_API_PORT (8765) et LOCAL_WEB_PORT (5273).
set -e
cd "$(dirname "$0")/.."
API_PORT="${LOCAL_API_PORT:-8765}"
WEB_PORT="${LOCAL_WEB_PORT:-5273}"
(cd apps/api && uv sync --quiet)
(cd apps/web && [ -d node_modules ] || npm ci --silent)
trap 'kill 0' INT TERM EXIT
LOCAL_API_PORT="$API_PORT" apps/api/.venv/bin/python scripts/local_demo.py &
cd apps/web
echo "Application : http://localhost:$WEB_PORT"
VITE_DEV_AUTH=1 API_TARGET="http://localhost:$API_PORT" npx vite --port "$WEB_PORT" --strictPort

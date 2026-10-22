# Dépendances et licences

Vérification : `pip-licenses` (Python) et `license-checker` (npm) exécutés sur l'arbre de dépendances installé.
Résultat : aucune licence copyleft forte (GPL/AGPL) en dépendance directe ; licences dominantes MIT, BSD, Apache-2.0.

## Applicatif

| Composant | Licence | Composant | Licence |
|---|---|---|---|
| React, React Router, Vite, Zustand, TanStack Query, React Hook Form, Zod, Recharts, Radix UI, Tailwind CSS, class-variance-authority, clsx, tailwind-merge | MIT | Lucide React | ISC |
| oidc-client-ts | Apache-2.0 | shadcn/ui (approche reprise ; composants écrits dans ce dépôt) | MIT |
| FastAPI, Pydantic, SQLAlchemy, Alembic, PyJWT | MIT | Uvicorn, httpx, Jinja2, pandas, SymPy, WeasyPrint | BSD-3-Clause |
| SDK Python OpenAI | Apache-2.0 | psycopg 3 | **LGPL-3.0** (usage par import dynamique, sans modification) |

Dépendances transitives à noter : `pyphen` (tri-licence GPLv2+/LGPLv2+/MPL 1.1, utilisée par WeasyPrint — usage sous MPL/LGPL), `certifi` (MPL-2.0).
Pango (système, LGPL) est requis par WeasyPrint.

## Infrastructure

PostgreSQL (PostgreSQL License) · Keycloak (Apache-2.0) · Caddy (Apache-2.0) · Podman (Apache-2.0).
Valkey (BSD-3) et pgvector (PostgreSQL License) : non utilisés dans le MVP.

## Outils de test

pytest (MIT) · Ruff (MIT) · Vitest (MIT) · ESLint (MIT) · Prettier (MIT) · Playwright (Apache-2.0).

## Service propriétaire autorisé

API OpenAI — seule dépendance non open source, isolée derrière `ai/providers/base.py::LLMProvider`.

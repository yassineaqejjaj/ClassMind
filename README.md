# ClassMind

*Chaque élève apprend différemment. Chaque enseignant mérite de savoir comment.*

Plateforme SaaS pour enseignants (MVP : mathématiques de cinquième, chapitre « nombres relatifs ») :
import de résultats CSV → analyse par compétence → génération d'exercices adaptés (OpenAI, vérifiés par SymPy)
→ validation humaine → export PDF → comparaison de deux évaluations.

Stack 100 % open source (React/Vite/Tailwind, FastAPI, PostgreSQL, Keycloak, Caddy, Podman) ;
**seule exception : l'API OpenAI**, isolée derrière `ai/providers/base.py`.
Voir [architecture](docs/architecture.md), [licences](docs/licences.md), [analyse de risque](docs/analyse-risque-reglementaire.md).

> ⚠️ Données fictives uniquement tant que l'analyse de risque n'est pas validée par votre DPO.

## Démarrage avec Podman (pile complète)

Prérequis : Linux, Podman + `podman compose`.

```bash
cp .env.example .env        # renseigner les mots de passe, OPENAI_API_KEY, OPENAI_MODEL et les tarifs
podman compose up -d --build
```

- Application : http://localhost:8080 · API : `/api/docs` · Keycloak : `/auth` (admin défini dans `.env`)
- Compte de démonstration : `enseignant.demo` (mot de passe temporaire `demo-a-changer`, à changer à la première connexion ; **à supprimer en production**).
- Un enseignant doit avoir le rôle `teacher` et l'attribut `establishment_id` (entier) dans Keycloak ; `establishment_admin` donne accès à toutes les classes de l'établissement et aux réglages.
- Production : définir `CLASSMIND_HOST` (nom de domaine → HTTPS automatique), `PUBLIC_URL`, `OIDC_ISSUER` en `https://…`, lancer Keycloak en mode `start` avec base dédiée, adapter les `redirectUris` du realm (`infrastructure/keycloak/classmind-realm.json`).
- Purge de conservation : planifier `scripts/purge_expired.sh`.

## Développement local

```bash
cd apps/api && uv sync && uv run pytest && uv run ruff check .
cd apps/web && npm install && npm run lint && npm test && npm run build
```

`scripts/dev.sh` lance API (:8000) et web (:5173). PostgreSQL et Keycloak sont requis (`podman compose up -d db keycloak`).
Les tests backend utilisent SQLite en mémoire et un fournisseur LLM factice **réservé aux tests**.
Le test PDF nécessite Pango (système) et est ignoré s'il est absent ; il s'exécute dans le conteneur API.
Tests e2e (Playwright) : `cd apps/web && npx playwright install chromium && npx playwright test` avec la pile lancée.

Données d'exemple : `docs/sample-data/` (CSV fictifs et association question → compétence).

## Configuration OpenAI

`OPENAI_API_KEY`, `OPENAI_MODEL` (aucun modèle codé en dur), `LLM_PRICE_INPUT_PER_M` / `LLM_PRICE_OUTPUT_PER_M`
(tarifs du modèle, pour le suivi des coûts), plafond mensuel par établissement (Paramètres). Sans clé, la génération répond 503.

## Structure

`apps/web` (React) · `apps/api` (FastAPI) · `ai/` (fournisseurs, prompts, schémas, validateurs, cas d'évaluation) ·
`infrastructure/` (conteneurs, Caddy, Keycloak) · `tests/e2e` · `docs/`.

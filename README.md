# ClassMind

> *Chaque élève apprend différemment. Chaque enseignant mérite de savoir comment.*

ClassMind est une plateforme web pour enseignants. Elle transforme les résultats d'une évaluation en un diagnostic par compétence, aide à préparer des exercices adaptés avec un modèle de langage, puis mesure la progression entre deux évaluations.

**Périmètre du MVP :** mathématiques de cinquième (France), chapitre « Nombres relatifs ».

> ⚠️ **Données fictives uniquement.** Aucune donnée d'élève réelle ne doit être utilisée tant que l'[analyse de risque réglementaire](docs/analyse-risque-reglementaire.md) n'a pas été validée par le DPO de l'établissement.

![Tableau de bord](docs/screenshots/02-tableau-de-bord.png)

## Sommaire

- [Fonctionnement](#fonctionnement)
- [Captures d'écran](#captures-décran)
- [Principes de conception](#principes-de-conception)
- [Architecture](#architecture)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Référence technique](#référence-technique)
- [Tests et qualité](#tests-et-qualité)
- [Déploiement](#déploiement)
- [Sécurité et protection des données](#sécurité-et-protection-des-données)
- [Limites connues](#limites-connues)
- [Structure du dépôt](#structure-du-dépôt)
- [Licences](#licences)

## Fonctionnement

La boucle centrale de ClassMind :

```
Évaluation → Analyse → Adaptation → Exercices → Nouvelle évaluation → Progression
```

| Étape | Ce que fait ClassMind | Qui décide |
|---|---|---|
| **Importer** | Lit un CSV (un élève par ligne, une colonne par question) et associe chaque question à une compétence du référentiel. | L'enseignant confirme chaque association. |
| **Analyser** | Calcule la réussite par compétence, les erreurs fréquentes, le positionnement des élèves et propose des groupes de remédiation. | Les chiffres sont calculés en Python ; l'enseignant valide les groupes. |
| **Adapter** | Génère trois variantes d'exercices avec corrigés et explications (LLM), puis **vérifie chaque calcul avec SymPy**. | L'enseignant relit, modifie, valide ou rejette. |
| **Exporter** | Produit un PDF (version élèves, avec ou sans corrigé), uniquement pour une série validée. | L'enseignant. |
| **Comparer** | Montre l'évolution par compétence entre deux évaluations, sans l'attribuer automatiquement à ClassMind. | L'enseignant interprète. |

**L'enseignant reste responsable des décisions pédagogiques** : aucune décision scolaire n'est prise automatiquement, et tout contenu généré par IA doit être validé avant usage.

### Fonctionnalités du MVP

- Authentification enseignant (OpenID Connect, Keycloak) et rôles (`teacher`, `establishment_admin`).
- Classes et élèves identifiés **uniquement par des pseudonymes** (génération d'identifiants aléatoires).
- Référentiel de cinquième : 8 compétences sur les nombres relatifs, avec prérequis et exemples.
- Import CSV guidé en trois étapes (fichier, association, résumé), avec détection des réponses vides.
- Analyse : réussite par compétence, répartition des points par question, erreurs fréquentes, groupes proposés, points à vérifier.
- Interprétation pédagogique par LLM à partir de **statistiques agrégées** (jamais de pseudonymes).
- Studio IA : trois variantes, vérification SymPy, édition, historique de validation, rejet, export PDF.
- Comparaison de deux évaluations : variation par compétence, erreurs persistantes, synthèse et limites d'interprétation.
- Export et suppression des données d'une classe, durée de conservation configurable, plafond de consommation IA par établissement.

## Captures d'écran

> Captures réalisées avec des données fictives (classe « 5e B », 6 élèves pseudonymes), une authentification et un fournisseur LLM simulés **uniquement pour la prise de vue** (script hors du dépôt). L'application livrée n'utilise aucune réponse simulée.

| | |
|---|---|
| ![Connexion](docs/screenshots/01-connexion.png) **Connexion** (redirection vers Keycloak) | ![Détail d'une classe](docs/screenshots/03-detail-classe.png) **Détail d'une classe** : maîtrise par compétence, répartition des élèves, évaluations |
| ![Import : fichier](docs/screenshots/04-import-fichier.png) **Import, étape 1** : dépôt du CSV et contrôle de lisibilité | ![Import : association](docs/screenshots/05-import-association.png) **Import, étape 2** : association question → compétence |
| ![Analyse](docs/screenshots/06-analyse.png) **Analyse pédagogique** : réussite, erreurs fréquentes, suggestions | ![Studio IA](docs/screenshots/07-studio-ia.png) **Studio IA** : variantes, vérification par calcul, validation |
| ![Progression](docs/screenshots/08-progression.png) **Progression** : comparaison de deux évaluations | ![Carte des compétences](docs/screenshots/09-competences.png) **Carte des compétences** : prérequis et exemples |

## Principes de conception

1. **Le LLM n'est pas une source de vérité.** Toute statistique est calculée en Python ; tout calcul généré est contredit ou confirmé par SymPy. Une réponse contredite **bloque la validation et l'export**.
2. **Aucune donnée personnelle ne part vers le LLM.** Le prompt contient la compétence, la difficulté, le type d'exercice, le nombre de questions, les consignes de l'enseignant (filtrées : e-mails et numéros refusés) et des statistiques agrégées.
3. **La logique pédagogique ne dépend pas du fournisseur.** Le seul point de couplage à OpenAI est l'interface `LLMProvider`.
4. **Humain dans la boucle.** Les groupes sont des « propositions », les interprétations IA sont des « hypothèses », la validation des exercices est obligatoire et tracée.
5. **Stack open source.** Seule exception : l'API OpenAI pour les fonctions de langage.
6. **Accessibilité.** Cibles de 44 px, focus visible, statuts toujours exprimés par couleur + icône + mot, tableaux équivalents aux graphiques, respect de `prefers-reduced-motion` (objectif WCAG 2.2 AA ; non audité formellement).

## Architecture

```mermaid
flowchart LR
  B[Navigateur<br/>React + TypeScript] -->|HTTPS| C[Caddy]
  C -->|/| W[Fichiers statiques]
  C -->|/api| A[FastAPI]
  C -->|/auth| K[Keycloak<br/>OIDC]
  A --> D[(PostgreSQL)]
  A --> AI[ai/<br/>LLMProvider]
  AI -->|Responses API| O[OpenAI]
  AI --> S[SymPy + règles<br/>de validation]
  B -.->|Authorization Code + PKCE| K
```

Décisions détaillées : [docs/architecture.md](docs/architecture.md).

### Flux de génération d'exercices

```mermaid
sequenceDiagram
  participant E as Enseignant
  participant API as FastAPI
  participant AI as ai/
  participant LLM as OpenAI
  E->>API: POST /exercises/generate
  API->>API: Contrôle du plafond mensuel
  API->>AI: prompt (sans donnée d'élève)
  AI->>LLM: responses.parse (schéma Pydantic)
  LLM-->>AI: 3 variantes structurées
  AI->>AI: contrôles de structure + données personnelles
  AI->>AI: SymPy : expression ↔ réponse
  API-->>E: brouillon (statuts de vérification)
  E->>API: modification / validation / rejet
  E->>API: GET /exercises/{id}/pdf (si validé)
```

### Stack

| Couche | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI (composants dans le style shadcn/ui), TanStack Query, Zustand, React Hook Form, Zod, Recharts, Lucide, oidc-client-ts |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy 2, Alembic, pandas, Jinja2, WeasyPrint, PyJWT |
| IA | SDK officiel OpenAI (Responses API), sorties structurées Pydantic, SymPy |
| Données | PostgreSQL (SQLite en mémoire pour les tests) |
| Identité | Keycloak (auto-hébergé), OpenID Connect |
| Infrastructure | Podman / Compose, Caddy |
| Qualité | pytest, Ruff, Vitest, ESLint, Prettier, Playwright |

## Démarrage rapide

### Démo locale en une commande (sans Podman, Keycloak ni PostgreSQL)

Prérequis : [uv](https://docs.astral.sh/uv/) et Node.js 22+.

```bash
scripts/local-demo.sh
```

Ouvrez <http://localhost:5273>. Le script démarre l'API (base SQLite dans `.local/`, classe fictive « 5e B » et deux évaluations déjà importées) et le frontend, avec une **authentification de développement** qui connecte un enseignant fixe. Ports modifiables : `LOCAL_API_PORT` (8765) et `LOCAL_WEB_PORT` (5273).

Pour tester la génération d'exercices avec un vrai modèle, créez un `.env` à la racine **avant** de lancer :

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=...
# tarifs du modèle (EUR / million de tokens), pour le suivi des coûts
LLM_PRICE_INPUT_PER_M=0
LLM_PRICE_OUTPUT_PER_M=0
```

Sans clé, tout fonctionne sauf la génération IA (message « Service IA non configuré »). Seul ce mode démo contourne Keycloak : le contournement n'existe que dans `vite dev` avec `VITE_DEV_AUTH=1` (absent des builds de production) et dans `scripts/local_demo.py`, à ne jamais exposer sur un réseau.

### Pile complète avec Podman

Prérequis : Linux, Podman et `podman compose`.

```bash
cp .env.example .env     # renseigner les mots de passe, OPENAI_API_KEY, OPENAI_MODEL et les tarifs
podman compose up -d --build
```

- Application : <http://localhost:8080>
- Documentation OpenAPI : <http://localhost:8080/api/docs>
- Keycloak : `/auth` (administrateur défini dans `.env`)
- Compte de démonstration : `enseignant.demo` (mot de passe temporaire `demo-a-changer`, à changer à la première connexion ; **à supprimer en production**).

### Développement local

Prérequis : [uv](https://docs.astral.sh/uv/), Node.js 22+, une instance PostgreSQL et Keycloak (`podman compose up -d db keycloak`).

```bash
# API
cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m app.cli seed          # charge le référentiel de cinquième
uv run uvicorn app.main:app --reload   # http://localhost:8000

# Frontend (autre terminal)
cd apps/web
npm install
npm run dev                            # http://localhost:5173 (proxy /api → :8000)
```

Si le port 8000 est occupé : `API_TARGET=http://localhost:PORT npm run dev`.

Des CSV d'exemple (fictifs) sont fournis dans [`docs/sample-data/`](docs/sample-data/) : deux évaluations et le fichier d'association question → compétence.

## Configuration

Variables d'environnement de l'API (voir [`.env.example`](.env.example)) :

| Variable | Rôle | Défaut |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (SQLAlchemy) | `postgresql+psycopg://classmind:classmind@localhost:5432/classmind` |
| `CORS_ORIGINS` | Origines autorisées (séparées par des virgules) | `http://localhost:5173` |
| `OIDC_ISSUER` | URL du realm Keycloak | `http://localhost:8080/auth/realms/classmind` |
| `OIDC_AUDIENCE` | Audience attendue dans le jeton | `classmind-api` |
| `OIDC_JWKS_URL` | Clés de signature (par défaut dérivée de l'émetteur) | — |
| `OIDC_ESTABLISHMENT_CLAIM` | Claim portant l'identifiant d'établissement | `establishment_id` |
| `OPENAI_API_KEY` | Clé API (**côté serveur uniquement**) | — |
| `OPENAI_MODEL` | Modèle utilisé (jamais codé en dur) | — |
| `OPENAI_TIMEOUT_S` / `OPENAI_MAX_RETRIES` | Délai d'expiration et tentatives limitées | `60` / `2` |
| `LLM_PRICE_INPUT_PER_M` / `LLM_PRICE_OUTPUT_PER_M` | Tarifs du modèle en EUR par million de tokens (suivi des coûts) | `0` |
| `LLM_DEFAULT_MONTHLY_CAP_EUR` | Plafond mensuel par établissement | `20` |
| `CSV_MAX_BYTES` | Taille maximale d'un CSV | `1000000` |

Sans `OPENAI_API_KEY` et `OPENAI_MODEL`, les routes de génération répondent `503` ; le reste de l'application fonctionne.

**Provisionner un enseignant dans Keycloak :** rôle `teacher` (ou `establishment_admin`) et attribut utilisateur `establishment_id` (entier), exposé dans le jeton par le scope `classmind-api-access` du realm fourni.

## Utilisation

1. **Créer une classe** (Mes classes), puis générer des identifiants pseudonymes (onglet *Élèves*). La correspondance pseudonyme ↔ élève reste **hors de ClassMind**.
2. **Importer une évaluation** : CSV avec une colonne `pseudonyme`, une colonne par question (`Q1`, `Q2`…) et, facultativement, `Qn_erreur` pour saisir l'erreur observée.

   ```csv
   pseudonyme,Q1,Q2,Q3,Q2_erreur,Q3_erreur
   E-AB3K7,2,1,0,,oubli de la règle des signes
   E-CD4M8,1,0,0,confusion opposé/inverse,soustraction traitée comme addition
   ```

   Séparateurs `,` `;` ou tabulation, encodage UTF-8. Les cellules vides sont comptées comme *non traitées*, pas comme fausses. Un pseudonyme qui ressemble à un nom (espaces, accents, e-mail) est refusé.
3. **Lire l'analyse**, puis demander des suggestions IA si besoin.
4. **Préparer des exercices** dans le Studio IA : relire, modifier (les calculs sont revérifiés), valider, exporter en PDF.
5. **Comparer** deux évaluations depuis la classe (*Progression*).

Seuils de lecture : ≥ 75 % *Maîtrisé*, 50–74 % *En progrès*, < 50 % *À retravailler* (vocabulaire centré sur les compétences, pas sur les élèves).

## Référence technique

### API REST

Préfixe `/api`, documentation interactive sur `/api/docs`. Toutes les routes exigent un jeton Bearer valide.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/me`, `/competencies`, `/dashboard`, `/settings` | Contexte, référentiel, tableau de bord, usage IA |
| PUT | `/settings` | Plafond IA et conservation (administrateur) |
| GET, POST | `/classes` | Lister, créer |
| GET, DELETE | `/classes/{id}` | Détail (vue d'ensemble, répartition), suppression |
| GET | `/classes/{id}/export` | Export pseudonymisé (JSON) |
| GET | `/classes/{id}/history` | Activités récentes |
| POST | `/classes/{id}/students`, `/classes/{id}/students/generate` | Ajouter / générer des pseudonymes |
| DELETE | `/classes/{id}/students/{sid}` | Supprimer un élève et ses résultats |
| GET, POST | `/classes/{id}/assessments` | Lister / importer (multipart : `title`, `held_on`, `mapping`, `file`) |
| GET | `/assessments/{id}/analysis` | Statistiques, erreurs, groupes proposés |
| POST | `/assessments/{id}/summary` | Interprétation LLM (statistiques agrégées) |
| DELETE | `/assessments/{id}` | Supprimer une évaluation |
| GET | `/classes/{id}/progress?before=&after=` | Comparaison de deux évaluations |
| POST | `/exercises/generate` | Trois variantes + vérification SymPy |
| GET | `/exercises`, `/exercises/{id}` | Bibliothèque, détail et historique |
| PUT | `/exercises/{id}` | Modification (revérification, retour en brouillon) |
| POST | `/exercises/{id}/validate`, `/reject` | Validation humaine (refusée si un calcul est contredit) / rejet |
| GET | `/exercises/{id}/pdf?answers=` | Export PDF (série validée uniquement) |

Codes notables : `409` (validation/export impossible), `422` (import ou contenu refusé), `429` (plafond IA atteint), `502` (erreur du fournisseur LLM), `503` (IA non configurée).

### Modèle de données

```mermaid
erDiagram
  ESTABLISHMENT ||--o{ CLASS : possède
  CLASS ||--o{ STUDENT : "pseudonymes"
  CLASS ||--o{ ASSESSMENT : contient
  ASSESSMENT ||--o{ QUESTION : "barème"
  QUESTION }o--|| COMPETENCY : évalue
  QUESTION ||--o{ RESULT : "points"
  STUDENT ||--o{ RESULT : obtient
  COMPETENCY }o--o{ COMPETENCY : "prérequis"
  ESTABLISHMENT ||--o{ EXERCISE_SET : "variantes (JSON)"
  EXERCISE_SET ||--o{ VALIDATION_EVENT : historique
  ESTABLISHMENT ||--o{ LLM_USAGE : "tokens et coûts"
```

Migrations Alembic dans `apps/api/alembic/`. Le référentiel est chargé par `python -m app.cli seed` (idempotent).

### Couche IA (`ai/`)

```
ai/
  providers/   base.py (interface LLMProvider), openai_provider.py (Responses API)
  prompts/     exercise_generation.py, error_analysis.py, explanations.py
  schemas/     exercise.py, analysis.py        # contrats Pydantic des sorties
  validators/  math_validator.py, content_validator.py
  evaluation/  test_cases.py                   # cas de référence des vérifications
```

- **Sorties structurées** : `responses.parse` avec un schéma Pydantic ; refus et réponses vides gérés.
- **Fiabilité** : délai d'expiration, tentatives limitées, erreurs de débit converties en réponses explicites.
- **Coûts** : tokens consommés et coût enregistrés par appel (`llm_usage`) ; plafond mensuel par établissement vérifié *avant* chaque appel.
- **Journalisation** : opération, établissement, tokens, coût — jamais le contenu des prompts ni des réponses. Appels avec `store=False`.
- **Vérification mathématique** : `expression` et `answer` sont filtrées par liste blanche de caractères (jamais d'`eval` de texte libre), évaluées en rationnels par SymPy ; statuts `verified`, `mismatch`, `unverifiable`.
- **Changer de fournisseur** : implémenter `LLMProvider.generate_structured` et l'injecter dans `app/api/deps.py::get_provider`.

### Sécurité

- JWT Keycloak validé côté API (signature JWKS, émetteur, audience, expiration, rôles).
- Isolation stricte : chaque requête est filtrée par établissement **et** par propriétaire (sauf `establishment_admin`).
- Flux Authorization Code + PKCE ; jetons conservés en `sessionStorage`.
- CORS restreint, en-têtes de sécurité via Caddy, conteneur API non-root, taille des CSV limitée.
- La clé OpenAI ne quitte jamais le serveur ; secrets uniquement dans `.env` (non versionné).

## Tests et qualité

```bash
# Backend : 35 tests (isolation des établissements, JWT, import CSV, analyse,
# vérification SymPy, flux de validation, plafond de coût, rejet…)
cd apps/api && uv run pytest && uv run ruff check . ../../ai

# Frontend : lecture CSV (Vitest), types, lint, build
cd apps/web && npm test && npx tsc -b && npm run lint && npm run build

# Bout en bout (pile complète lancée)
cd apps/web && npx playwright install chromium && npx playwright test
```

Les tests backend utilisent SQLite en mémoire et un fournisseur LLM factice **réservé aux tests** (`apps/api/tests/conftest.py`). Le test d'export PDF nécessite Pango et est ignoré s'il est absent ; il s'exécute dans l'image du conteneur API.

## Déploiement

- **Serveur Linux** : `podman compose up -d --build` après avoir renseigné `.env`. Définir `CLASSMIND_HOST` (nom de domaine → HTTPS automatique par Caddy), `PUBLIC_URL` et `OIDC_ISSUER` en `https://…`.
- **Keycloak en production** : lancer en mode `start` avec une base dédiée, adapter les `redirectUris` du realm ([`infrastructure/keycloak/classmind-realm.json`](infrastructure/keycloak/classmind-realm.json)), supprimer le compte de démonstration.
- **Conservation** : planifier [`scripts/purge_expired.sh`](scripts/purge_expired.sh) (cron ou timer systemd) pour supprimer les évaluations au-delà de la durée définie par établissement.
- **Sauvegardes** : volume PostgreSQL `dbdata` à sauvegarder selon la politique de l'établissement.

## Sécurité et protection des données

ClassMind est conçu avec la minimisation, la pseudonymisation, l'isolation des établissements, l'export et la suppression, des durées de conservation, un historique de validation et l'absence de décision automatique. Une analyse préliminaire (RGPD, données de mineurs, règlement européen sur l'IA, transferts vers le fournisseur LLM) est fournie dans [docs/analyse-risque-reglementaire.md](docs/analyse-risque-reglementaire.md). **Elle doit être revue par un DPO avant tout usage avec des données réelles**, notamment les conditions de traitement des données du fournisseur LLM.

## Limites connues

- Mathématiques de cinquième, chapitre « Nombres relatifs » uniquement ; un seul établissement par jeton.
- Validation et rejet portent sur la **série entière** (trois variantes), pas sur chaque variante.
- La vérification SymPy ne couvre que les calculs numériques à une expression ; les autres questions sont signalées « non vérifiables automatiquement » et relèvent de la relecture humaine.
- L'association question → compétence est choisie par l'enseignant (pas de suggestion automatique) ; le CSV ne contient pas les énoncés.
- Les tests Playwright sont écrits mais n'ont pas été exécutés en intégration continue ; l'accessibilité WCAG 2.2 AA n'a pas fait l'objet d'un audit formel.
- Hors périmètre : portail parents, chatbot élève, application mobile.

## Structure du dépôt

```
apps/
  api/        FastAPI (app/api, core, models, schemas, services), migrations Alembic, tests
  web/        React + Vite (src/components, pages, features, services, stores)
ai/           fournisseurs, prompts, schémas, validateurs, cas d'évaluation
infrastructure/   Containerfiles, Caddy, realm Keycloak
tests/e2e/    scénarios Playwright
docs/         architecture, licences, analyse de risque, données d'exemple, captures
scripts/      développement local, purge de conservation
compose.yaml  pile Podman/Compose
```

## Licences

Toutes les dépendances sont open source (MIT, BSD, Apache-2.0 en grande majorité ; `psycopg` en LGPL-3.0 par import dynamique). Seule exception : l'API OpenAI, isolée derrière `LLMProvider`. Inventaire complet : [docs/licences.md](docs/licences.md).

La licence du code de ClassMind lui-même n'est pas encore définie : à choisir avant toute diffusion publique.

# Architecture ClassMind

## Vue d'ensemble

```
Navigateur ── Caddy ─┬─ /            React (build statique)
                     ├─ /api/*       FastAPI ── PostgreSQL
                     │                  └─ ai/ ── LLMProvider ── OpenAI (Responses API)
                     └─ /auth/*      Keycloak (OIDC, PKCE)
```

La boucle centrale : évaluation (CSV) → analyse (Python) → adaptation → exercices (LLM + SymPy)
→ validation humaine → PDF → nouvelle évaluation → progression.

## Décisions techniques

| # | Décision | Raison |
|---|----------|--------|
| 1 | Monolithe FastAPI + SPA React | Architecture simple, un seul déploiement. |
| 2 | Couche `ai/` indépendante de FastAPI et de la base | La logique pédagogique ne dépend pas du fournisseur ; `LLMProvider` est l'unique point de couplage à OpenAI. |
| 3 | Statistiques, groupes, progression calculés en Python | Le LLM n'invente aucun résultat ; il ne reçoit que des agrégats (sans pseudonymes). |
| 4 | SymPy vérifie chaque calcul (`expression` ↔ `answer`) | Un LLM n'est pas une source de vérité. Les expressions passent par une liste blanche de caractères avant analyse (pas d'`eval` de texte libre). Une réponse contredite bloque la validation. |
| 5 | Sorties structurées (`responses.parse` + schémas Pydantic) | Contrat strict ; contrôle de structure supplémentaire dans `content_validator`. |
| 6 | Modèle OpenAI, clé et tarifs uniquement par variables d'environnement | Aucun modèle codé en dur ; coûts calculés à partir des tokens réels. |
| 7 | Plafond mensuel de consommation par établissement (table `llm_usage`) | Maîtrise des coûts ; refus HTTP 429 au dépassement. |
| 8 | JWT Keycloak vérifié côté API (JWKS, audience, émetteur) ; claim `establishment_id` | Isolation stricte : toute requête est filtrée par établissement ET par propriétaire (sauf rôle `establishment_admin`). |
| 9 | Élèves = pseudonymes uniquement, validés par regex | Minimisation : aucun nom, e-mail ou identifiant direct en base. |
| 10 | Pas de Valkey ni pgvector dans le MVP | Aucun besoin avéré (génération synchrone, pas de recherche sémantique). Ajout possible sans impact sur l'architecture. |
| 11 | `store=False` sur les appels OpenAI, aucun contenu de prompt journalisé | Réduction de la rétention côté fournisseur et des fuites dans les logs. |

## Modèle de données

`establishments` ← `classes` ← `students` (pseudonyme) ; `assessments` → `questions` (→ `competencies`) → `results` ;
`competencies` + `competency_prerequisites` (graphe) ; `exercise_sets` (variantes en JSON) ;
`validation_events` (historique génération/modification/validation) ; `llm_usage` (tokens, coût).

## Routes API (préfixe `/api`, documentation : `/api/docs`)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/me`, `/competencies`, `/dashboard`, `/settings` | contexte, référentiel, tableau de bord, usage IA |
| PUT | `/settings` | plafond IA et conservation (admin) |
| GET/POST | `/classes` · GET/DELETE `/classes/{id}` | gestion des classes |
| GET | `/classes/{id}/export` | export pseudonymisé (RGPD) |
| POST | `/classes/{id}/students`, `/students/generate` · DELETE `/students/{sid}` | pseudonymes |
| POST/GET | `/classes/{id}/assessments` | import CSV + association question→compétence |
| GET | `/assessments/{id}/analysis` | réussite, erreurs, groupes proposés |
| POST | `/assessments/{id}/summary` | interprétation LLM de statistiques agrégées |
| GET | `/classes/{id}/progress?before=&after=` | comparaison de deux évaluations |
| POST | `/exercises/generate` | 3 variantes + vérification SymPy |
| GET/PUT | `/exercises`, `/exercises/{id}` | bibliothèque, modification (revérification) |
| POST | `/exercises/{id}/validate` | validation humaine (refusée si calcul contredit) |
| POST | `/exercises/{id}/reject` | rejet par l'enseignant (série non exportable) |
| GET | `/exercises/{id}/pdf?answers=` | export PDF (uniquement si validé) |

## Sécurité

OIDC Authorization Code + PKCE ; jetons en `sessionStorage` ; CORS restreint ; en-têtes de sécurité via Caddy ;
conteneur API non-root ; clé OpenAI uniquement côté API ; taille CSV limitée ; mots de passe/secrets uniquement
dans `.env` (non versionné).

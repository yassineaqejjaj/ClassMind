# Analyse préliminaire du risque réglementaire

> Document de travail à faire valider par le DPO / conseil juridique de l'établissement **avant tout usage avec des données réelles**.
> ClassMind n'est à ce stade utilisé qu'avec des données fictives.

## 1. RGPD et données de mineurs
- **Minimisation** : aucun nom, e-mail, date de naissance ; seulement un pseudonyme (3-32 caractères alphanumériques) et des scores. La table de correspondance reste hors ClassMind, chez l'enseignant.
- **Pseudonymisation ≠ anonymisation** : les données restent personnelles (l'établissement peut ré-identifier). Une AIPD (DPIA) est recommandée : traitement de données de mineurs, évaluation systématique.
- **Base légale / rôles** : à qualifier (établissement responsable de traitement, hébergeur sous-traitant ; pour un organisme de soutien, base contractuelle ou intérêt légitime).
- **Droits** : export JSON d'une classe (`/classes/{id}/export`), suppression de classe, d'élève et d'évaluation.
- **Conservation** : durée par établissement (`retention_days`, 365 par défaut) ; purge via `python -m app.cli purge` (à planifier).
- **Isolation** : filtrage par établissement et propriétaire sur chaque route ; tests automatisés d'isolation.
- **Sécurité** : OIDC/PKCE, TLS (Caddy), conteneurs non-root, journaux sans données personnelles.

## 2. Transfert au LLM (OpenAI)
- Aucune donnée d'élève n'est transmise : seuls partent la compétence, la difficulté, le type, le nombre de questions, des contraintes libres de l'enseignant (contrôle automatique e-mail/téléphone) et des **statistiques agrégées**.
- Appels avec `store=False`. Journaux : opération, tokens, coût — jamais le contenu.
- À vérifier avant production : conditions de traitement des données (DPA), localisation/transferts hors UE, rétention côté fournisseur, option zéro rétention, sous-traitants ultérieurs.
- Le fournisseur est interchangeable (`LLMProvider`) si ces conditions ne conviennent pas.

## 3. Règlement européen sur l'IA
- Les systèmes d'IA destinés à évaluer les résultats d'apprentissage ou à orienter l'éducation figurent parmi les cas **à haut risque** (annexe III). ClassMind est conçu comme **aide à l'enseignant** : aucune décision automatique, groupes marqués « proposition », validation humaine obligatoire des contenus, avertissement sur les interprétations IA, pas d'attribution causale des progrès.
- À confirmer juridiquement : qualification exacte (haut risque ou non selon l'usage), obligations de transparence, documentation technique, supervision humaine, journalisation (l'historique de validation y contribue), formation des utilisateurs.

## 4. Risques résiduels et mesures
| Risque | Mesure |
|---|---|
| Erreur mathématique du LLM | Vérification SymPy, blocage de la validation, relecture humaine |
| Biais / sur-interprétation des statistiques | Seuils transparents (≥75 % acquise, 50-75 % en cours), formulation en hypothèses |
| Ré-identification par recoupement | Pseudonymes aléatoires non signifiants (`E-XXXXX`), table de correspondance hors outil |
| Dépassement de coûts | Plafond mensuel par établissement, suivi des tokens |
| Fuite de secrets | `.env` hors dépôt, clé uniquement côté API |

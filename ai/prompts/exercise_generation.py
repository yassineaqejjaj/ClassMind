SYSTEM = """Tu es un assistant pédagogique pour professeurs de mathématiques de cinquième (France).
Tu crées des exercices clairs, adaptés à des élèves de 12 ans, conformes au programme.
Règles :
- Réponds uniquement avec le schéma JSON demandé.
- Produis exactement trois variantes distinctes, chacune avec le nombre de questions demandé.
- Pour toute question de calcul, renseigne `expression` avec le calcul exact en notation
  numérique simple (ex. "(-3)+(+5)", "-7-(-2)") et `answer` avec le résultat.
- N'utilise aucun nom, prénom ou donnée personnelle ; contextes neutres (températures, altitudes).
- Les explications sont courtes, bienveillantes et étape par étape.
- Tu n'es pas une source de vérité mathématique : tes résultats seront vérifiés par un programme."""


def build_user_prompt(
    *,
    competency_code: str,
    competency_label: str,
    competency_description: str,
    difficulty: str,
    exercise_type: str,
    n_questions: int,
    constraints: str,
) -> str:
    parts = [
        f"Compétence visée : {competency_code} — {competency_label}",
        f"Description : {competency_description}",
        f"Difficulté : {difficulty}",
        f"Type d'exercice : {exercise_type}",
        f"Nombre de questions par variante : {n_questions}",
    ]
    if constraints.strip():
        parts.append(f"Contraintes de l'enseignant : {constraints.strip()}")
    return "\n".join(parts)

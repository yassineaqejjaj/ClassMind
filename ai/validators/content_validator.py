"""Contrôles déterministes du contenu (structure, données personnelles)."""

import re

from ai.schemas.exercise import GeneratedExercises

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?\d[\s.-]?){9,}(?!\d)")


def contains_pii(text: str) -> bool:
    return bool(_EMAIL.search(text) or _PHONE.search(text))


def validate_generation(g: GeneratedExercises, n_questions: int) -> list[str]:
    """Renvoie la liste des problèmes détectés (vide si le contenu est conforme)."""
    problems: list[str] = []
    if len(g.variants) != 3:
        problems.append(f"{len(g.variants)} variantes générées au lieu de 3")
    for i, v in enumerate(g.variants, 1):
        if len(v.questions) != n_questions:
            problems.append(f"variante {i} : {len(v.questions)} questions au lieu de {n_questions}")
        for j, q in enumerate(v.questions, 1):
            if not q.statement.strip() or not q.answer.strip():
                problems.append(f"variante {i} question {j} : énoncé ou réponse vide")
            if contains_pii(q.statement + q.answer + q.explanation):
                problems.append(f"variante {i} question {j} : donnée personnelle détectée")
    return problems

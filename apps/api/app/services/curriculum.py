from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Competency, CompetencyPrerequisite

CHAPTER = "Nombres relatifs"

# code, libellé, description, exemple, prérequis
SEED = [
    (
        "NR1",
        "Repérer un nombre relatif sur une droite graduée",
        "Placer et lire l'abscisse d'un point sur une droite graduée.",
        "Placer -3,5 sur la droite.",
        [],
    ),
    (
        "NR2",
        "Comparer des nombres relatifs",
        "Comparer et ranger des nombres relatifs.",
        "Ranger -4 ; 2 ; -7 ; 0 dans l'ordre croissant.",
        ["NR1"],
    ),
    (
        "NR3",
        "Déterminer l'opposé d'un nombre",
        "Connaître l'opposé d'un nombre relatif.",
        "Quel est l'opposé de -8 ?",
        ["NR1"],
    ),
    (
        "NR4",
        "Additionner des nombres relatifs",
        "Additionner deux nombres relatifs.",
        "Calculer (-3) + (+5).",
        ["NR1", "NR3"],
    ),
    (
        "NR5",
        "Soustraire des nombres relatifs",
        "Soustraire en ajoutant l'opposé.",
        "Calculer (-7) - (-2).",
        ["NR3", "NR4"],
    ),
    (
        "NR6",
        "Calculer une suite d'additions et de soustractions",
        "Supprimer les parenthèses et calculer une expression.",
        "Calculer -3 + 8 - 5 + 2.",
        ["NR5"],
    ),
    (
        "NR7",
        "Calculer une distance à zéro",
        "Distance entre un point et l'origine.",
        "Quelle est la distance à zéro de -6 ?",
        ["NR1"],
    ),
    (
        "NR8",
        "Résoudre un problème avec des nombres relatifs",
        "Modéliser une situation (température, altitude).",
        "Il fait -4 °C et la température gagne 7 °C.",
        ["NR4"],
    ),
]


def seed_curriculum(db: Session) -> None:
    """Insère le référentiel de cinquième (idempotent)."""
    existing = {c.code: c for c in db.scalars(select(Competency))}
    for code, label, desc, ex, _ in SEED:
        if code not in existing:
            c = Competency(code=code, chapter=CHAPTER, label=label, description=desc, example=ex)
            db.add(c)
            existing[code] = c
    db.flush()
    have = {(p.competency_id, p.prerequisite_id) for p in db.scalars(select(CompetencyPrerequisite))}
    for code, *_, prereqs in SEED:
        for pre in prereqs:
            key = (existing[code].id, existing[pre].id)
            if key not in have:
                db.add(CompetencyPrerequisite(competency_id=key[0], prerequisite_id=key[1]))
    db.commit()

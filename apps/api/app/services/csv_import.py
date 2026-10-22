"""Import CSV d'évaluation (format large : pseudonyme, Q1, Q2, ... et Qn_erreur optionnelles)."""

import io
import re
from dataclasses import dataclass, field

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Assessment, Competency, Question, Result, SchoolClass, Student

PSEUDO_RE = re.compile(r"^[A-Za-z0-9_-]{3,32}$")
PSEUDO_COLUMNS = ("pseudonyme", "pseudo", "identifiant")


class ImportError_(ValueError):  # noqa: N801
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass
class QuestionSpec:
    code: str
    competency_code: str
    max_points: float


@dataclass
class ImportReport:
    assessment_id: int
    students_created: int = 0
    results: int = 0
    warnings: list[str] = field(default_factory=list)


def create_assessment_from_csv(
    db: Session,
    *,
    school_class: SchoolClass,
    title: str,
    held_on: str,
    specs: list[QuestionSpec],
    csv_bytes: bytes,
) -> ImportReport:
    errors: list[str] = []
    try:
        df = pd.read_csv(io.BytesIO(csv_bytes), sep=None, engine="python", dtype=str, encoding="utf-8-sig")
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as exc:
        raise ImportError_(["Fichier CSV illisible (UTF-8 attendu)"]) from exc
    df.columns = [str(c).strip() for c in df.columns]
    lower = {c.lower(): c for c in df.columns}
    pseudo_col = next((lower[n] for n in PSEUDO_COLUMNS if n in lower), None)
    if pseudo_col is None:
        raise ImportError_(["Colonne « pseudonyme » manquante"])

    comps = {c.code: c for c in db.scalars(select(Competency))}
    spec_by_code = {}
    for s in specs:
        if s.competency_code not in comps:
            errors.append(f"Compétence inconnue : {s.competency_code}")
        if s.max_points <= 0:
            errors.append(f"Barème invalide pour {s.code}")
        if s.code not in df.columns:
            errors.append(f"Colonne {s.code} absente du CSV")
        spec_by_code[s.code] = s
    if not specs:
        errors.append("Aucune question associée à une compétence")

    seen: set[str] = set()
    for p in df[pseudo_col]:
        p = "" if pd.isna(p) else str(p).strip()
        if not PSEUDO_RE.match(p):
            errors.append(f"Pseudonyme invalide « {p[:12]} » (3-32 caractères : lettres, chiffres, - _)")
        elif p in seen:
            errors.append(f"Pseudonyme en double : {p}")
        seen.add(p)
    if errors:
        raise ImportError_(errors[:30])

    # Valeurs numériques
    parsed: dict[tuple[str, str], tuple[float, str | None]] = {}
    for _, row in df.iterrows():
        pseudo = str(row[pseudo_col]).strip()
        for s in specs:
            raw = row[s.code]
            if pd.isna(raw) or str(raw).strip() == "":
                continue
            try:
                pts = float(str(raw).replace(",", "."))
            except ValueError:
                errors.append(f"{pseudo}/{s.code} : « {raw} » n'est pas un nombre")
                continue
            if not 0 <= pts <= s.max_points:
                errors.append(f"{pseudo}/{s.code} : {pts} hors barème (0 à {s.max_points})")
                continue
            tag = None
            err_col = lower.get(f"{s.code.lower()}_erreur")
            if err_col is not None and not pd.isna(row[err_col]):
                tag = str(row[err_col]).strip()[:100] or None
            parsed[(pseudo, s.code)] = (pts, tag)
    if errors:
        raise ImportError_(errors[:30])

    assessment = Assessment(
        establishment_id=school_class.establishment_id,
        class_id=school_class.id,
        title=title,
        held_on=held_on,
    )
    db.add(assessment)
    db.flush()
    questions = {}
    for s in specs:
        q = Question(
            assessment_id=assessment.id,
            code=s.code,
            competency_id=comps[s.competency_code].id,
            max_points=s.max_points,
        )
        db.add(q)
        questions[s.code] = q
    students = {st.pseudonym: st for st in db.scalars(select(Student).where(Student.class_id == school_class.id))}
    report = ImportReport(assessment_id=assessment.id)
    for pseudo in sorted(seen):
        if pseudo not in students:
            st = Student(class_id=school_class.id, pseudonym=pseudo)
            db.add(st)
            students[pseudo] = st
            report.students_created += 1
    db.flush()
    for (pseudo, code), (pts, tag) in parsed.items():
        db.add(
            Result(
                assessment_id=assessment.id,
                question_id=questions[code].id,
                student_id=students[pseudo].id,
                points=pts,
                error_tag=tag,
            )
        )
        report.results += 1
    missing = len(seen) * len(specs) - report.results
    if missing:
        report.warnings.append(f"{missing} résultat(s) manquant(s) ignoré(s)")
    db.commit()
    return report

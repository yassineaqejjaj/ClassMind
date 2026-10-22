import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user, load_class
from app.core.db import get_db
from app.core.security import Principal
from app.models import Assessment, Result, SchoolClass, Student
from app.schemas import ClassIn, ClassOut, GenerateIdsIn, StudentsIn
from app.services import analysis

router = APIRouter(prefix="/classes", tags=["classes"])
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _out(c: SchoolClass) -> ClassOut:
    return ClassOut(
        id=c.id,
        name=c.name,
        level=c.level,
        school_year=c.school_year,
        n_students=len(c.students),
        n_assessments=len(c.assessments),
    )


@router.get("", response_model=list[ClassOut])
def list_classes(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    q = select(SchoolClass).where(SchoolClass.establishment_id == user.establishment_id)
    if not user.is_admin:
        q = q.where(SchoolClass.owner_sub == user.sub)
    return [_out(c) for c in db.scalars(q.order_by(SchoolClass.name))]


@router.post("", response_model=ClassOut, status_code=201)
def create_class(body: ClassIn, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    c = SchoolClass(establishment_id=user.establishment_id, owner_sub=user.sub, **body.model_dump())
    db.add(c)
    db.commit()
    return _out(c)


@router.get("/{class_id}")
def class_detail(class_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    c = load_class(db, user, class_id)
    ordered = sorted(c.assessments, key=lambda a: a.held_on)
    all_stats = [analysis.assessment_stats(db, a) for a in ordered]
    latest = all_stats[-1] if all_stats else None
    return {
        **_out(c).model_dump(),
        "students": [{"id": s.id, "pseudonym": s.pseudonym} for s in c.students],
        "assessments": [
            {
                "id": a.id,
                "title": a.title,
                "held_on": a.held_on,
                "n_students": st["n_students"],
                "n_questions": st["n_questions"],
                "overall_rate": st["overall_rate"],
            }
            for a, st in zip(ordered, all_stats, strict=True)
        ],
        "latest": analysis.public_stats(latest) if latest else None,
        "distribution": analysis.distribution(latest) if latest else [],
    }


@router.delete("/{class_id}", status_code=204)
def delete_class(class_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    c = load_class(db, user, class_id)
    ids = [a.id for a in c.assessments]
    for r in db.scalars(select(Result).where(Result.assessment_id.in_(ids or [0]))):
        db.delete(r)
    db.flush()
    db.delete(c)
    db.commit()


@router.get("/{class_id}/export")
def export_class(class_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Export des données de la classe (droit d'accès / portabilité), pseudonymisées."""
    c = load_class(db, user, class_id)
    pseudo = {s.id: s.pseudonym for s in c.students}
    out = _out(c).model_dump()
    out["assessments"] = []
    for a in c.assessments:
        qs = {q.id: q for q in a.questions}
        rows = db.scalars(select(Result).where(Result.assessment_id == a.id)).all()
        out["assessments"].append(
            {
                "title": a.title,
                "held_on": a.held_on,
                "results": [
                    {
                        "pseudonym": pseudo[r.student_id],
                        "question": qs[r.question_id].code,
                        "competency": qs[r.question_id].competency.code,
                        "points": r.points,
                        "error": r.error_tag,
                    }
                    for r in rows
                ],
            }
        )
    return out


@router.post("/{class_id}/students", status_code=201)
def add_students(
    class_id: int, body: StudentsIn, user: Principal = Depends(current_user), db: Session = Depends(get_db)
):
    c = load_class(db, user, class_id)
    existing = {s.pseudonym for s in c.students}
    new = [p for p in dict.fromkeys(body.pseudonyms) if p not in existing]
    db.add_all(Student(class_id=c.id, pseudonym=p) for p in new)
    db.commit()
    return {"created": len(new), "ignored": len(body.pseudonyms) - len(new)}


@router.post("/{class_id}/students/generate", status_code=201)
def generate_ids(
    class_id: int, body: GenerateIdsIn, user: Principal = Depends(current_user), db: Session = Depends(get_db)
):
    """Génère des identifiants aléatoires non signifiants (table de correspondance tenue par l'enseignant)."""
    c = load_class(db, user, class_id)
    existing = {s.pseudonym for s in c.students}
    created: list[str] = []
    while len(created) < body.count:
        p = "E-" + "".join(secrets.choice(_ALPHABET) for _ in range(5))
        if p not in existing:
            existing.add(p)
            created.append(p)
    db.add_all(Student(class_id=c.id, pseudonym=p) for p in created)
    db.commit()
    return {"pseudonyms": created}


@router.delete("/{class_id}/students/{student_id}", status_code=204)
def delete_student(
    class_id: int, student_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)
):
    load_class(db, user, class_id)
    s = db.get(Student, student_id)
    if s is None or s.class_id != class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Élève introuvable")
    for r in db.scalars(select(Result).where(Result.student_id == s.id)):
        db.delete(r)
    db.delete(s)
    db.commit()


__all__ = ["router", "Assessment"]

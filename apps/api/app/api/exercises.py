from ai.providers.base import LLMProvider, ProviderError
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user, get_provider
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.security import Principal
from app.models import Competency, ExerciseSet, ValidationEvent
from app.schemas import GenerateExercisesIn, VariantsIn
from app.services.ai_service import AIService, BudgetExceeded, ContentRejected, recheck_variants
from app.services.pdf import render_exercises_pdf

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _load(db: Session, user: Principal, eid: int) -> ExerciseSet:
    e = db.get(ExerciseSet, eid)
    if e is None or e.establishment_id != user.establishment_id or not (user.is_admin or e.owner_sub == user.sub):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exercice introuvable")
    return e


def _out(e: ExerciseSet) -> dict:
    return {
        "id": e.id,
        "competency_code": e.competency.code,
        "competency_label": e.competency.label,
        "difficulty": e.difficulty,
        "exercise_type": e.exercise_type,
        "n_questions": e.n_questions,
        "constraints": e.constraints,
        "status": e.status,
        "created_at": e.created_at.isoformat(),
        "variants": e.variants,
    }


def _log(db: Session, e: ExerciseSet, user: Principal, action: str) -> None:
    db.add(ValidationEvent(exercise_set_id=e.id, actor_sub=user.sub, action=action))


@router.post("/generate", status_code=201)
def generate(
    body: GenerateExercisesIn,
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
):
    comp = db.scalar(select(Competency).where(Competency.code == body.competency_code))
    if comp is None:
        raise HTTPException(422, "Compétence inconnue")
    try:
        variants = AIService(db, provider, settings).generate_exercises(
            establishment_id=user.establishment_id,
            competency=comp,
            difficulty=body.difficulty,
            exercise_type=body.exercise_type,
            n_questions=body.n_questions,
            constraints=body.constraints,
        )
    except BudgetExceeded as exc:
        raise HTTPException(429, str(exc)) from exc
    except ContentRejected as exc:
        raise HTTPException(422, str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(502, str(exc)) from exc
    e = ExerciseSet(
        establishment_id=user.establishment_id,
        owner_sub=user.sub,
        competency_id=comp.id,
        difficulty=body.difficulty,
        exercise_type=body.exercise_type,
        n_questions=body.n_questions,
        constraints=body.constraints,
        variants=variants,
    )
    db.add(e)
    db.flush()
    _log(db, e, user, "generated")
    db.commit()
    return _out(e)


@router.get("")
def list_exercises(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    q = select(ExerciseSet).where(ExerciseSet.establishment_id == user.establishment_id)
    if not user.is_admin:
        q = q.where(ExerciseSet.owner_sub == user.sub)
    return [_out(e) for e in db.scalars(q.order_by(ExerciseSet.id.desc()))]


@router.get("/{eid}")
def get_exercise(eid: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    e = _load(db, user, eid)
    history = db.scalars(
        select(ValidationEvent).where(ValidationEvent.exercise_set_id == e.id).order_by(ValidationEvent.id)
    )
    return {**_out(e), "history": [{"action": h.action, "at": h.at.isoformat()} for h in history]}


@router.put("/{eid}")
def edit_exercise(eid: int, body: VariantsIn, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Modification par l'enseignant : les calculs sont revérifiés et la validation est annulée."""
    e = _load(db, user, eid)
    try:
        variants = [
            {
                "label": str(v["label"]),
                "title": str(v["title"]),
                "questions": [
                    {k: q.get(k) for k in ("statement", "expression", "answer", "explanation")} for q in v["questions"]
                ],
            }
            for v in body.variants
        ]
    except (KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(422, "Structure de variantes invalide") from exc
    e.variants = recheck_variants(variants)
    e.status = "draft"
    _log(db, e, user, "edited")
    db.commit()
    return _out(e)


@router.post("/{eid}/validate")
def validate(eid: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Validation humaine : refusée tant qu'un calcul est contredit par SymPy."""
    e = _load(db, user, eid)
    bad = [
        f"variante {v['label']}, question {i + 1} (calcul : {q.get('verified_answer')})"
        for v in e.variants
        for i, q in enumerate(v["questions"])
        if q.get("check") == "mismatch"
    ]
    if bad:
        raise HTTPException(409, "Réponse contredite par la vérification : " + " ; ".join(bad[:5]))
    e.status = "validated"
    _log(db, e, user, "validated")
    db.commit()
    return _out(e)


@router.post("/{eid}/reject")
def reject(eid: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Rejet par l'enseignant : le contenu n'est plus exportable."""
    e = _load(db, user, eid)
    e.status = "rejected"
    _log(db, e, user, "rejected")
    db.commit()
    return _out(e)


@router.get("/{eid}/pdf")
def export_pdf(eid: int, answers: bool = False, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    e = _load(db, user, eid)
    if e.status != "validated":
        raise HTTPException(409, "L'exercice doit être validé par l'enseignant avant l'export")
    pdf = render_exercises_pdf(e, with_answers=answers)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="exercices-{e.id}.pdf"'},
    )

import json
import re

from ai.providers.base import LLMProvider, ProviderError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user, get_provider, load_class
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.security import Principal
from app.models import Assessment, Result, Student
from app.schemas import QuestionMap
from app.services import analysis, progress
from app.services.ai_service import AIService, BudgetExceeded
from app.services.csv_import import ImportError_, QuestionSpec, create_assessment_from_csv

router = APIRouter(tags=["assessments"])
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_assessment(db: Session, user: Principal, aid: int) -> Assessment:
    a = db.get(Assessment, aid)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Évaluation introuvable")
    load_class(db, user, a.class_id)  # contrôle établissement + propriétaire
    return a


@router.post("/classes/{class_id}/assessments", status_code=201)
async def import_assessment(
    class_id: int,
    title: str = Form(min_length=1, max_length=200),
    held_on: str = Form(),
    mapping: str = Form(description="JSON : liste {code, competency_code, max_points}"),
    file: UploadFile = File(),
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    c = load_class(db, user, class_id)
    if not DATE.match(held_on):
        raise HTTPException(422, "Date attendue au format AAAA-MM-JJ")
    try:
        specs = [QuestionSpec(**QuestionMap(**m).model_dump()) for m in json.loads(mapping)]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(422, "Association questions/compétences invalide") from exc
    data = await file.read(settings.csv_max_bytes + 1)
    if len(data) > settings.csv_max_bytes:
        raise HTTPException(413, "Fichier trop volumineux")
    try:
        report = create_assessment_from_csv(
            db, school_class=c, title=title, held_on=held_on, specs=specs, csv_bytes=data
        )
    except ImportError_ as exc:
        db.rollback()
        raise HTTPException(422, {"message": "Import refusé", "errors": exc.errors}) from exc
    return report.__dict__


@router.get("/classes/{class_id}/assessments")
def list_assessments(class_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    c = load_class(db, user, class_id)
    return [
        {"id": a.id, "title": a.title, "held_on": a.held_on} for a in sorted(c.assessments, key=lambda a: a.held_on)
    ]


@router.get("/assessments/{aid}/analysis")
def get_analysis(aid: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    a = load_assessment(db, user, aid)
    stats = analysis.assessment_stats(db, a)
    return {
        **analysis.public_stats(stats),
        "class_id": a.class_id,
        "class_name": a.school_class.name,
        "groups": analysis.propose_groups(stats),
    }


@router.post("/assessments/{aid}/summary")
def ai_summary(
    aid: int,
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
    provider: LLMProvider = Depends(get_provider),
    settings: Settings = Depends(get_settings),
):
    """Interprétation pédagogique par le LLM. Seules des statistiques agrégées sont transmises."""
    a = load_assessment(db, user, aid)
    stats = analysis.public_stats(analysis.assessment_stats(db, a))
    try:
        summary = AIService(db, provider, settings).summarize_results(user.establishment_id, stats)
    except BudgetExceeded as exc:
        raise HTTPException(429, str(exc)) from exc
    except ProviderError as exc:
        raise HTTPException(502, str(exc)) from exc
    return {**summary.model_dump(), "notice": "Hypothèses générées par IA, à valider par l'enseignant."}


@router.get("/classes/{class_id}/progress")
def class_progress(
    class_id: int,
    before: int,
    after: int,
    user: Principal = Depends(current_user),
    db: Session = Depends(get_db),
):
    load_class(db, user, class_id)
    a, b = load_assessment(db, user, before), load_assessment(db, user, after)
    if a.class_id != class_id or b.class_id != class_id or a.id == b.id:
        raise HTTPException(422, "Deux évaluations distinctes de la même classe sont requises")
    return progress.compare(analysis.assessment_stats(db, a), analysis.assessment_stats(db, b))


@router.delete("/assessments/{aid}", status_code=204)
def delete_assessment(aid: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    a = load_assessment(db, user, aid)
    for r in db.scalars(select(Result).where(Result.assessment_id == a.id)):
        db.delete(r)
    db.flush()
    db.delete(a)
    db.commit()


__all__ = ["router", "Student"]


@router.get("/classes/{class_id}/history")
def class_history(class_id: int, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    """Activités récentes : imports d'évaluations de la classe et actions de l'utilisateur sur ses exercices."""
    from app.models import ExerciseSet, ValidationEvent

    c = load_class(db, user, class_id)
    items = [
        {"at": a.created_at.isoformat(), "kind": "import", "text": f"Import de l'évaluation « {a.title} »"}
        for a in c.assessments
    ]
    labels = {
        "generated": "Génération d'exercices",
        "edited": "Modification d'exercices",
        "validated": "Validation d'exercices",
        "rejected": "Rejet d'exercices",
    }
    rows = db.execute(
        select(ValidationEvent, ExerciseSet)
        .join(ExerciseSet, ExerciseSet.id == ValidationEvent.exercise_set_id)
        .where(ExerciseSet.establishment_id == user.establishment_id, ValidationEvent.actor_sub == user.sub)
    ).all()
    items += [
        {
            "at": ev.at.isoformat(),
            "kind": ev.action,
            "text": f"{labels.get(ev.action, ev.action)} · {ex.competency.code}",
        }
        for ev, ex in rows
    ]
    return sorted(items, key=lambda i: i["at"], reverse=True)[:20]

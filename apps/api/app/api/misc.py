from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.security import Principal
from app.models import Competency, CompetencyPrerequisite, Establishment, SchoolClass
from app.schemas import CapIn
from app.services.ai_service import AIService

router = APIRouter(tags=["misc"])


@router.get("/me")
def me(user: Principal = Depends(current_user)):
    return {"sub": user.sub, "establishment_id": user.establishment_id, "roles": sorted(user.roles)}


@router.get("/competencies")
def competencies(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    pre: dict[int, list[int]] = {}
    for p in db.scalars(select(CompetencyPrerequisite)):
        pre.setdefault(p.competency_id, []).append(p.prerequisite_id)
    comps = list(db.scalars(select(Competency).order_by(Competency.code)))
    code = {c.id: c.code for c in comps}
    return [
        {
            "code": c.code,
            "level": c.level,
            "chapter": c.chapter,
            "label": c.label,
            "description": c.description,
            "example": c.example,
            "prerequisites": sorted(code[i] for i in pre.get(c.id, [])),
        }
        for c in comps
    ]


@router.get("/settings")
def get_settings_info(
    user: Principal = Depends(current_user), db: Session = Depends(get_db), s: Settings = Depends(get_settings)
):
    est = db.get(Establishment, user.establishment_id)
    svc = AIService(db, None, s)  # type: ignore[arg-type]  # lecture seule des coûts
    return {
        "establishment": est.name,
        "monthly_llm_cap_eur": est.monthly_llm_cap_eur,
        "month_spend_eur": round(svc.month_spend(est.id), 4),
        "retention_days": est.retention_days,
        "llm_model_configured": bool(s.openai_api_key and s.openai_model),
    }


@router.put("/settings")
def update_settings(body: CapIn, user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    from fastapi import HTTPException

    if not user.is_admin:
        raise HTTPException(403, "Réservé aux administrateurs de l'établissement")
    est = db.get(Establishment, user.establishment_id)
    est.monthly_llm_cap_eur, est.retention_days = body.monthly_llm_cap_eur, body.retention_days
    db.commit()
    return {"ok": True}


@router.get("/dashboard")
def dashboard(user: Principal = Depends(current_user), db: Session = Depends(get_db)):
    from app.services import analysis

    q = select(SchoolClass).where(SchoolClass.establishment_id == user.establishment_id)
    if not user.is_admin:
        q = q.where(SchoolClass.owner_sub == user.sub)
    out = []
    for c in db.scalars(q.order_by(SchoolClass.name)):
        last = max(c.assessments, key=lambda a: a.held_on, default=None)
        stats = analysis.public_stats(analysis.assessment_stats(db, last)) if last else None
        out.append({"class_id": c.id, "name": c.name, "n_students": len(c.students), "latest": stats})
    return out

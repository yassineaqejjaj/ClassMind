"""Durées de conservation : purge des évaluations plus anciennes que la durée configurée."""

from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Assessment, Establishment, Question, Result, now


def purge_expired(db: Session) -> int:
    purged = 0
    for est in db.scalars(select(Establishment)):
        cutoff = now() - timedelta(days=est.retention_days)
        ids = list(
            db.scalars(
                select(Assessment.id).where(Assessment.establishment_id == est.id, Assessment.created_at < cutoff)
            )
        )
        if not ids:
            continue
        db.execute(delete(Result).where(Result.assessment_id.in_(ids)))
        db.execute(delete(Question).where(Question.assessment_id.in_(ids)))
        db.execute(delete(Assessment).where(Assessment.id.in_(ids)))
        purged += len(ids)
    db.commit()
    return purged

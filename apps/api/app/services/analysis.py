"""Statistiques calculées en Python (jamais par le LLM)."""

from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Assessment, Question, Result, Student

ACQUIRED = 0.75
IN_PROGRESS = 0.5


def level_of(rate: float) -> str:
    if rate >= ACQUIRED:
        return "acquise"
    if rate >= IN_PROGRESS:
        return "en_cours"
    return "à_retravailler"


def assessment_stats(db: Session, assessment: Assessment) -> dict:
    qs = {q.id: q for q in db.scalars(select(Question).where(Question.assessment_id == assessment.id))}
    results = db.scalars(select(Result).where(Result.assessment_id == assessment.id)).all()
    pts: dict[int, float] = defaultdict(float)
    mx: dict[int, float] = defaultdict(float)
    errors: dict[int, Counter] = defaultdict(Counter)
    per_student: dict[int, dict[int, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    by_question: dict[int, list[Result]] = defaultdict(list)
    tag_stats: dict[tuple[str, int], dict] = {}
    for r in results:
        by_question[r.question_id].append(r)
        q = qs[r.question_id]
        cid = q.competency_id
        pts[cid] += r.points
        mx[cid] += q.max_points
        if r.error_tag:
            errors[cid][r.error_tag] += 1
            t = tag_stats.setdefault((r.error_tag, cid), {"count": 0, "questions": set()})
            t["count"] += 1
            t["questions"].add(q.code)
        acc = per_student[r.student_id][cid]
        acc[0] += r.points
        acc[1] += q.max_points
    comps = {q.competency_id: q.competency for q in qs.values()}
    by_comp = []
    for cid, comp in sorted(comps.items(), key=lambda kv: kv[1].code):
        rate = pts[cid] / mx[cid] if mx[cid] else 0.0
        by_comp.append(
            {
                "competency_id": cid,
                "code": comp.code,
                "label": comp.label,
                "rate": round(rate, 4),
                "level": level_of(rate),
                "n_results": sum(1 for r in results if qs[r.question_id].competency_id == cid),
                "errors": [{"tag": t, "count": n} for t, n in errors[cid].most_common(5)],
            }
        )
    question_stats = []
    for q in sorted(qs.values(), key=lambda q: q.code):
        rs = by_question.get(q.id, [])
        full = sum(1 for r in rs if r.points >= q.max_points)
        none = sum(1 for r in rs if r.points <= 0)
        question_stats.append(
            {
                "code": q.code,
                "competency_code": q.competency.code,
                "max_points": q.max_points,
                "n": len(rs),
                "full": full,
                "partial": len(rs) - full - none,
                "none": none,
            }
        )
    error_list = sorted(
        (
            {
                "tag": tag,
                "count": v["count"],
                "competency_code": comps[cid].code,
                "competency_label": comps[cid].label,
                "questions": sorted(v["questions"]),
            }
            for (tag, cid), v in tag_stats.items()
        ),
        key=lambda e: (-e["count"], e["tag"]),
    )
    total_pts, total_max = sum(pts.values()), sum(mx.values())
    pseudo = {s.id: s.pseudonym for s in db.scalars(select(Student).where(Student.id.in_(list(per_student) or [0])))}
    return {
        "assessment_id": assessment.id,
        "title": assessment.title,
        "held_on": assessment.held_on,
        "n_students": len(per_student),
        "overall_rate": round(total_pts / total_max, 4) if total_max else 0.0,
        "n_questions": len(qs),
        "n_missing": len(per_student) * len(qs) - len(results),
        "questions": question_stats,
        "error_list": error_list,
        "competencies": by_comp,
        "to_rework": [c["code"] for c in by_comp if c["level"] == "à_retravailler"],
        "_overall": {
            pseudo[sid]: (
                sum(a[0] for a in d.values()) / sum(a[1] for a in d.values()) if sum(a[1] for a in d.values()) else 0.0
            )
            for sid, d in per_student.items()
        },
        "_per_student": {
            pseudo[sid]: {comps[cid].code: (a[0] / a[1] if a[1] else 0.0) for cid, a in d.items()}
            for sid, d in per_student.items()
        },
    }


def propose_groups(stats: dict) -> list[dict]:
    """Propositions de groupes par compétence à retravailler (à valider par l'enseignant)."""
    groups = []
    for comp in stats["competencies"]:
        if comp["level"] == "acquise":
            continue
        members = sorted(p for p, rates in stats["_per_student"].items() if rates.get(comp["code"], 1.0) < IN_PROGRESS)
        if members:
            groups.append(
                {
                    "competency_code": comp["code"],
                    "label": f"Remédiation {comp['code']}",
                    "pseudonyms": members,
                    "status": "proposition",
                }
            )
    return groups


def public_stats(stats: dict) -> dict:
    return {k: v for k, v in stats.items() if not k.startswith("_")}


def distribution(stats: dict) -> list[dict]:
    """Positionnement des élèves sur l'ensemble de l'évaluation (pseudonymes uniquement)."""
    groups = {k: [] for k in ("acquise", "en_cours", "à_retravailler")}
    for pseudo, rate in sorted(stats["_overall"].items()):
        groups[level_of(rate)].append(pseudo)
    return [{"level": k, "pseudonyms": v} for k, v in groups.items()]

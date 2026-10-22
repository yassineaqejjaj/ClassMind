from app.services.analysis import level_of


def compare(before: dict, after: dict) -> dict:
    """Évolution observée entre deux évaluations (sans attribution causale)."""
    b = {c["code"]: c for c in before["competencies"]}
    a = {c["code"]: c for c in after["competencies"]}
    rows = []
    for code in sorted(set(b) & set(a)):
        delta = a[code]["rate"] - b[code]["rate"]
        rows.append(
            {
                "code": code,
                "label": a[code]["label"],
                "rate_before": b[code]["rate"],
                "rate_after": a[code]["rate"],
                "delta": round(delta, 4),
                "level_before": level_of(b[code]["rate"]),
                "level_after": level_of(a[code]["rate"]),
                "trend": "hausse" if delta > 0.05 else "baisse" if delta < -0.05 else "stable",
            }
        )
    eb = {(e["tag"], e["competency_code"]): e["count"] for e in before["error_list"]}
    ea = {(e["tag"], e["competency_code"]): e["count"] for e in after["error_list"]}
    errors = sorted(
        (
            {"tag": t, "competency_code": c, "before": eb.get((t, c), 0), "after": ea.get((t, c), 0)}
            for t, c in set(eb) | set(ea)
        ),
        key=lambda e: (-e["after"], -e["before"], e["tag"]),
    )
    observed = [r for r in rows if r["trend"] == "hausse"]
    declined = [r for r in rows if r["trend"] == "baisse"]
    caveats = [
        "Les questions de deux évaluations ne sont jamais identiques : la comparaison porte sur les compétences.",
        "Cette évolution ne permet pas d'affirmer qu'elle vient des exercices préparés avec ClassMind : "
        "la séance de classe, le sujet et la période comptent aussi.",
    ]
    if before["n_students"] != after["n_students"]:
        caveats.insert(1, f"Le nombre de copies diffère ({before['n_students']} contre {after['n_students']}).")
    common = set(before["_per_student"]) & set(after["_per_student"])
    return {
        "before": {"id": before["assessment_id"], "title": before["title"], "held_on": before["held_on"]},
        "after": {"id": after["assessment_id"], "title": after["title"], "held_on": after["held_on"]},
        "competencies": rows,
        "common_students": len(common),
        "n_before": before["n_students"],
        "n_after": after["n_students"],
        "errors": errors,
        "observations": {
            "up": [{"code": r["code"], "label": r["label"], "delta": r["delta"]} for r in observed],
            "down": [{"code": r["code"], "label": r["label"], "delta": r["delta"]} for r in declined],
            "stable": [r["code"] for r in rows if r["trend"] == "stable"],
        },
        "caveats": caveats,
        "only_in_one": [c for c in set(b) ^ set(a)],
        "disclaimer": (
            "Évolution observée entre deux évaluations ; elle ne permet pas d'attribuer "
            "les écarts à l'usage de ClassMind (difficulté des sujets, effectifs, contexte)."
        ),
    }

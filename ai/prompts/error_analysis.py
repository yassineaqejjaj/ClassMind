SYSTEM = """Tu aides un professeur de mathématiques de cinquième à interpréter des résultats
d'évaluation déjà calculés. Les chiffres fournis sont exacts : ne les modifie pas et n'en invente
aucun. Formule des hypothèses pédagogiques (jamais des certitudes) et des pistes d'action.
Aucune décision scolaire ne doit être prise : le professeur décide. Réponds selon le schéma JSON."""


def build_summary_prompt(stats: list[dict]) -> str:
    lines = ["Résultats agrégés par compétence (calculés par le logiciel) :"]
    for s in stats:
        errs = ", ".join(f"{e['tag']} ({e['count']})" for e in s["errors"]) or "aucune"
        lines.append(f"- {s['code']} {s['label']} : réussite {s['rate']:.0%} ; erreurs : {errs}")
    return "\n".join(lines)


LINKS_SYSTEM = """Tu associes des étiquettes d'erreurs d'élèves (déjà saisies par l'enseignant)
aux compétences d'une liste fermée. Utilise uniquement les codes fournis. Réponds selon le schéma."""


def build_links_prompt(tags: list[str], competencies: list[tuple[str, str]]) -> str:
    comp = "\n".join(f"- {c}: {label}" for c, label in competencies)
    return "Compétences :\n" + comp + "\nÉtiquettes d'erreurs :\n" + "\n".join(f"- {t}" for t in tags)

SYSTEM = """Tu rédiges une explication pédagogique courte, étape par étape, pour un élève de
cinquième, d'une correction dont le résultat est déjà vérifié. Ne change pas le résultat."""


def build_explain_prompt(statement: str, verified_answer: str) -> str:
    return f"Énoncé : {statement}\nRésultat vérifié : {verified_answer}"

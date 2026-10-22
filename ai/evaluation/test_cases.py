"""Cas de référence pour évaluer les contrôles mathématiques (utilisés par pytest)."""

# (expression, réponse proposée, statut attendu)
MATH_CASES = [
    ("(-3)+(+5)", "2", "verified"),
    ("(-3)+(+5)", "-2", "mismatch"),
    ("-7-(-2)", "-5", "verified"),
    ("-7-(-2)", "-9", "mismatch"),
    ("(-4)*(-3)", "12", "verified"),
    ("-12/4", "-3", "verified"),
    ("1/2+1/3", "5/6", "verified"),
    ("-2,5+1,5", "-1", "verified"),
    ("−2 + 8", "6", "verified"),
    ("(-3)+(+5)", "deux", "mismatch"),
    (None, "2", "unverifiable"),
    ("x+1", "2", "unverifiable"),
    ("__import__('os').system('ls')", "0", "unverifiable"),
    ("2**100000", "0", "unverifiable"),
    ("1/0", "0", "unverifiable"),
]

PII_CASES = [
    ("Écris à jean.dupont@exemple.fr", True),
    ("Appelle le 06 12 34 56 78", True),
    ("Il fait -3 °C le matin et 5 °C à midi.", False),
]

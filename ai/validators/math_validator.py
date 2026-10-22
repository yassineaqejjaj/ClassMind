"""Vérification déterministe des calculs avec SymPy.

Les expressions proviennent d'un LLM : elles sont filtrées par liste blanche de caractères
avant tout appel à SymPy (jamais d'eval sur du texte libre).
"""

import re
from fractions import Fraction
from typing import Literal

import sympy
from sympy.parsing.sympy_parser import (
    parse_expr,
    rationalize,
    standard_transformations,
)

CheckStatus = Literal["verified", "mismatch", "unverifiable"]

_ALLOWED = re.compile(r"^[0-9+\-*/().\s]+$")
_TRANSFORMS = standard_transformations + (rationalize,)
MAX_LEN = 200


class UnsafeExpression(ValueError):
    pass


def _normalize(text: str) -> str:
    t = text.strip()
    for a, b in (("−", "-"), ("–", "-"), ("×", "*"), ("÷", "/"), ("·", "*"), (",", "."), (" ", ""), ("\xa0", "")):
        t = t.replace(a, b)
    return t


def parse_number(text: str) -> sympy.Rational:
    """Convertit une expression numérique (entiers, décimaux, fractions, + - * /) en rationnel."""
    t = _normalize(text)
    if not t or len(t) > MAX_LEN or not _ALLOWED.match(t) or "**" in t:
        raise UnsafeExpression("Expression non vérifiable")
    try:
        value = parse_expr(t, transformations=_TRANSFORMS, evaluate=True)
        value = sympy.nsimplify(value, rational=True)
    except (SyntaxError, TypeError, ValueError, ZeroDivisionError, sympy.SympifyError) as exc:
        raise UnsafeExpression("Expression non vérifiable") from exc
    if not value.is_Rational:
        raise UnsafeExpression("Résultat non rationnel")
    return value


def check_calculation(expression: str | None, answer: str) -> tuple[CheckStatus, str | None]:
    """Renvoie (statut, résultat calculé en texte) pour un couple expression / réponse."""
    if not expression or not expression.strip():
        return "unverifiable", None
    try:
        computed = parse_number(expression)
    except UnsafeExpression:
        return "unverifiable", None
    text = str(computed) if computed.q == 1 else f"{computed.p}/{computed.q}"
    try:
        given = parse_number(answer)
    except UnsafeExpression:
        return "mismatch", text
    return ("verified" if given == computed else "mismatch"), text


def as_fraction(value: sympy.Rational) -> Fraction:
    return Fraction(int(value.p), int(value.q))

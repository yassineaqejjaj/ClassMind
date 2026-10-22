import pytest
from ai.evaluation.test_cases import MATH_CASES, PII_CASES
from ai.schemas.exercise import GeneratedExercises, GeneratedQuestion, GeneratedVariant
from ai.validators.content_validator import contains_pii, validate_generation
from ai.validators.math_validator import check_calculation


@pytest.mark.parametrize("expr,answer,expected", MATH_CASES)
def test_math(expr, answer, expected):
    assert check_calculation(expr, answer)[0] == expected


def test_computed_value_is_returned():
    assert check_calculation("(-3)+(+5)", "7") == ("mismatch", "2")


@pytest.mark.parametrize("text,expected", PII_CASES)
def test_pii(text, expected):
    assert contains_pii(text) is expected


def _variant(n):
    return GeneratedVariant(title="t", questions=[GeneratedQuestion(statement="s", answer="1", explanation="e")] * n)


def test_generation_structure():
    ok = GeneratedExercises(variants=[_variant(2)] * 3)
    assert validate_generation(ok, 2) == []
    assert validate_generation(ok, 3)
    assert validate_generation(GeneratedExercises(variants=[_variant(2)]), 2)

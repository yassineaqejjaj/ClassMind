import re
from typing import Literal

from ai.schemas.exercise import Difficulty, ExerciseType
from pydantic import BaseModel, Field, field_validator

PSEUDO = re.compile(r"^[A-Za-z0-9_-]{3,32}$")


class ClassIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    level: str = Field(default="5e", max_length=20)
    school_year: str = Field(default="", max_length=9)


class ClassOut(ClassIn):
    id: int
    n_students: int = 0
    n_assessments: int = 0


class StudentsIn(BaseModel):
    pseudonyms: list[str] = Field(min_length=1, max_length=200)

    @field_validator("pseudonyms")
    @classmethod
    def valid(cls, v: list[str]) -> list[str]:
        for p in v:
            if not PSEUDO.match(p):
                raise ValueError("Pseudonyme invalide (3-32 caractères : lettres, chiffres, - _)")
        return v


class GenerateIdsIn(BaseModel):
    count: int = Field(ge=1, le=100)


class QuestionMap(BaseModel):
    code: str
    competency_code: str
    max_points: float = Field(gt=0, le=100)


class GenerateExercisesIn(BaseModel):
    competency_code: str
    difficulty: Difficulty = "moyen"
    exercise_type: ExerciseType = "calcul"
    n_questions: int = Field(default=5, ge=1, le=10)
    constraints: str = Field(default="", max_length=500)


class VariantsIn(BaseModel):
    variants: list[dict]


class CapIn(BaseModel):
    monthly_llm_cap_eur: float = Field(ge=0, le=10_000)
    retention_days: int = Field(ge=30, le=3650)


ExerciseStatus = Literal["draft", "validated"]

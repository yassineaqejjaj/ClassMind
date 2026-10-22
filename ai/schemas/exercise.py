from typing import Literal

from pydantic import BaseModel, Field

Difficulty = Literal["facile", "moyen", "difficile"]
ExerciseType = Literal["calcul", "problème", "vrai_faux", "qcm", "droite_graduée"]


class GeneratedQuestion(BaseModel):
    statement: str = Field(description="Énoncé de la question, en français, sans donnée personnelle")
    expression: str | None = Field(
        default=None,
        description="Calcul numérique à vérifier (chiffres, + - * / et parenthèses uniquement), "
        "ou null si la question n'est pas un calcul",
    )
    answer: str = Field(description="Réponse attendue (nombre ou fraction si calculable)")
    explanation: str = Field(description="Explication pédagogique de la correction")


class GeneratedVariant(BaseModel):
    title: str
    questions: list[GeneratedQuestion]


class GeneratedExercises(BaseModel):
    variants: list[GeneratedVariant] = Field(description="Exactement trois variantes")

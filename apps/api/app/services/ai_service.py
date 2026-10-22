"""Orchestration LLM : budget, prompts, validation déterministe, suivi des coûts."""

import logging
from datetime import datetime

from ai.prompts import error_analysis, exercise_generation
from ai.providers.base import LLMProvider, ProviderError
from ai.schemas.analysis import ResultsSummary
from ai.schemas.exercise import GeneratedExercises
from ai.validators.content_validator import contains_pii, validate_generation
from ai.validators.math_validator import check_calculation
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Competency, Establishment, LLMUsage

log = logging.getLogger("classmind.ai")


class BudgetExceeded(Exception):
    pass


class ContentRejected(Exception):
    pass


class AIService:
    def __init__(self, db: Session, provider: LLMProvider, settings: Settings):
        self.db, self.provider, self.settings = db, provider, settings

    # --- budget et coûts -------------------------------------------------
    def month_spend(self, establishment_id: int) -> float:
        start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total = self.db.scalar(
            select(func.coalesce(func.sum(LLMUsage.cost_eur), 0.0)).where(
                LLMUsage.establishment_id == establishment_id, LLMUsage.at >= start
            )
        )
        return float(total or 0.0)

    def cap(self, establishment_id: int) -> float:
        est = self.db.get(Establishment, establishment_id)
        return est.monthly_llm_cap_eur if est else self.settings.llm_default_monthly_cap_eur

    def _call(self, establishment_id: int, operation: str, system: str, user: str, schema):
        if self.month_spend(establishment_id) >= self.cap(establishment_id):
            raise BudgetExceeded("Plafond mensuel de consommation IA atteint pour l'établissement")
        res = self.provider.generate_structured(system=system, user=user, schema=schema, operation=operation)
        s = self.settings
        cost = (res.input_tokens * s.llm_price_input_per_m + res.output_tokens * s.llm_price_output_per_m) / 1_000_000
        self.db.add(
            LLMUsage(
                establishment_id=establishment_id,
                operation=operation,
                model=res.model,
                input_tokens=res.input_tokens,
                output_tokens=res.output_tokens,
                cost_eur=cost,
            )
        )
        self.db.commit()
        # Journal sans contenu ni donnée personnelle.
        log.info(
            "llm_call op=%s est=%s in=%s out=%s cost=%.5f",
            operation,
            establishment_id,
            res.input_tokens,
            res.output_tokens,
            cost,
        )
        return res.parsed

    # --- fonctions pédagogiques ----------------------------------------------
    def generate_exercises(
        self,
        *,
        establishment_id: int,
        competency: Competency,
        difficulty: str,
        exercise_type: str,
        n_questions: int,
        constraints: str,
    ) -> list[dict]:
        if contains_pii(constraints):
            raise ContentRejected("Les contraintes ne doivent contenir aucune donnée personnelle")
        user = exercise_generation.build_user_prompt(
            competency_code=competency.code,
            competency_label=competency.label,
            competency_description=competency.description,
            difficulty=difficulty,
            exercise_type=exercise_type,
            n_questions=n_questions,
            constraints=constraints,
        )
        gen: GeneratedExercises = self._call(
            establishment_id, "exercise_generation", exercise_generation.SYSTEM, user, GeneratedExercises
        )
        problems = validate_generation(gen, n_questions)
        if problems:
            raise ContentRejected("Contenu généré non conforme : " + "; ".join(problems[:5]))
        return [self._verify_variant(chr(65 + i), v.model_dump()) for i, v in enumerate(gen.variants)]

    @staticmethod
    def _verify_variant(label: str, variant: dict) -> dict:
        for q in variant["questions"]:
            q["check"], q["verified_answer"] = check_calculation(q.get("expression"), q["answer"])
        variant["label"] = label
        return variant

    def summarize_results(self, establishment_id: int, stats: dict) -> ResultsSummary:
        user = error_analysis.build_summary_prompt(stats["competencies"])
        return self._call(establishment_id, "results_summary", error_analysis.SYSTEM, user, ResultsSummary)


def recheck_variants(variants: list[dict]) -> list[dict]:
    """Revérifie avec SymPy après modification par l'enseignant."""
    for v in variants:
        for q in v["questions"]:
            q["check"], q["verified_answer"] = check_calculation(q.get("expression"), q["answer"])
    return variants


__all__ = ["AIService", "BudgetExceeded", "ContentRejected", "ProviderError", "recheck_variants"]

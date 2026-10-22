"""Fournisseur OpenAI via l'API Responses (SDK officiel)."""

import logging

import openai
from openai import OpenAI

from ai.providers.base import LLMProvider, LLMResult, ProviderError, ProviderNotConfigured, T

log = logging.getLogger("classmind.llm")


class OpenAIProvider(LLMProvider):
    def __init__(self, *, api_key: str | None, model: str | None, timeout_s: float, max_retries: int):
        if not api_key or not model:
            raise ProviderNotConfigured("OPENAI_API_KEY et OPENAI_MODEL doivent être définis")
        self.model = model
        # Le SDK gère les nouvelles tentatives limitées (erreurs temporaires, 429) avec attente.
        self.client = OpenAI(api_key=api_key, timeout=timeout_s, max_retries=max_retries)

    def generate_structured(self, *, system: str, user: str, schema: type[T], operation: str) -> LLMResult[T]:
        try:
            resp = self.client.responses.parse(
                model=self.model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                text_format=schema,
                store=False,
            )
        except openai.RateLimitError as exc:
            raise ProviderError("Limite de débit du fournisseur LLM atteinte") from exc
        except openai.APITimeoutError as exc:
            raise ProviderError("Délai dépassé côté fournisseur LLM") from exc
        except openai.OpenAIError as exc:
            # On ne journalise ni prompt ni réponse : uniquement le type d'erreur.
            log.warning("llm_error operation=%s type=%s", operation, type(exc).__name__)
            raise ProviderError("Erreur du fournisseur LLM") from exc
        if resp.output_parsed is None:
            raise ProviderError("Réponse LLM vide ou refusée")
        usage = resp.usage
        return LLMResult(
            parsed=resp.output_parsed,
            model=self.model,
            input_tokens=usage.input_tokens if usage else 0,
            output_tokens=usage.output_tokens if usage else 0,
        )

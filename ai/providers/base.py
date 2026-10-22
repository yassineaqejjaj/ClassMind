"""Interface indépendante du fournisseur LLM."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ProviderError(Exception):
    """Erreur du fournisseur LLM (réseau, délai, limite de débit, refus)."""


class ProviderNotConfigured(ProviderError):
    pass


@dataclass(frozen=True)
class LLMResult(Generic[T]):
    parsed: T
    model: str
    input_tokens: int
    output_tokens: int


class LLMProvider(ABC):
    @abstractmethod
    def generate_structured(self, *, system: str, user: str, schema: type[T], operation: str) -> LLMResult[T]:
        """Appelle le LLM et renvoie une sortie validée par le schéma Pydantic."""

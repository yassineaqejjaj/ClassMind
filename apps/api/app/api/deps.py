from ai.providers.base import LLMProvider, ProviderNotConfigured
from ai.providers.openai_provider import OpenAIProvider
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.security import Principal, get_principal
from app.models import Establishment, SchoolClass

_provider: LLMProvider | None = None


def get_provider(settings: Settings = Depends(get_settings)) -> LLMProvider:
    global _provider
    if _provider is None:
        try:
            _provider = OpenAIProvider(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                timeout_s=settings.openai_timeout_s,
                max_retries=settings.openai_max_retries,
            )
        except ProviderNotConfigured as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Service IA non configuré") from exc
    return _provider


def current_user(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> Principal:
    if db.get(Establishment, principal.establishment_id) is None:
        db.add(Establishment(id=principal.establishment_id, name=f"Établissement {principal.establishment_id}"))
        db.commit()
    return principal


def load_class(db: Session, user: Principal, class_id: int) -> SchoolClass:
    """Classe de l'établissement de l'utilisateur ; réservée à son propriétaire (ou admin)."""
    c = db.get(SchoolClass, class_id)
    if c is None or c.establishment_id != user.establishment_id or not (user.is_admin or c.owner_sub == user.sub):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Classe introuvable")
    return c

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://classmind:classmind@localhost:5432/classmind"
    cors_origins: str = "http://localhost:5173"

    # OIDC (Keycloak)
    oidc_issuer: str = "http://localhost:8080/auth/realms/classmind"
    oidc_audience: str = "classmind-api"
    oidc_jwks_url: str | None = None
    oidc_establishment_claim: str = "establishment_id"

    # OpenAI (seul fournisseur propriétaire autorisé)
    openai_api_key: str | None = None
    openai_model: str | None = None
    openai_timeout_s: float = 60.0
    openai_max_retries: int = 2
    # Tarifs en EUR par million de tokens, à renseigner selon le modèle choisi.
    llm_price_input_per_m: float = 0.0
    llm_price_output_per_m: float = 0.0
    llm_default_monthly_cap_eur: float = 20.0

    csv_max_bytes: int = 1_000_000

    @property
    def jwks_url(self) -> str:
        return self.oidc_jwks_url or f"{self.oidc_issuer}/protocol/openid-connect/certs"


@lru_cache
def get_settings() -> Settings:
    return Settings()

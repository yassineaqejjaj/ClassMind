"""Authentification OpenID Connect (Keycloak) et contrôle d'accès."""

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)

ROLE_TEACHER = "teacher"
ROLE_ADMIN = "establishment_admin"


@dataclass(frozen=True)
class Principal:
    sub: str
    establishment_id: int
    roles: frozenset[str]

    @property
    def is_admin(self) -> bool:
        return ROLE_ADMIN in self.roles


class TokenVerifier:
    """Vérifie un jeton d'accès JWT signé par Keycloak (clés JWKS)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._jwks = jwt.PyJWKClient(settings.jwks_url, cache_keys=True)

    def signing_key(self, token: str):
        return self._jwks.get_signing_key_from_jwt(token).key

    def verify(self, token: str) -> Principal:
        s = self.settings
        try:
            claims = jwt.decode(
                token,
                self.signing_key(token),
                algorithms=["RS256", "ES256"],
                audience=s.oidc_audience,
                issuer=s.oidc_issuer,
                options={"require": ["exp", "iss", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Jeton invalide") from exc
        roles = frozenset(claims.get("realm_access", {}).get("roles", []))
        raw_est = claims.get(s.oidc_establishment_claim)
        if not (roles & {ROLE_TEACHER, ROLE_ADMIN}) or raw_est is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        try:
            est = int(raw_est)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Établissement invalide") from exc
        return Principal(sub=claims["sub"], establishment_id=est, roles=roles)


_verifier: TokenVerifier | None = None


def get_verifier() -> TokenVerifier:
    global _verifier
    if _verifier is None:
        _verifier = TokenVerifier(get_settings())
    return _verifier


def get_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    verifier: TokenVerifier = Depends(get_verifier),
) -> Principal:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentification requise")
    return verifier.verify(creds.credentials)

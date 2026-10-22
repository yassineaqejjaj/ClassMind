import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core.config import Settings
from app.core.security import TokenVerifier


def test_establishment_isolation(client, other_establishment_client, make_client):
    cid = client.post("/api/classes", json={"name": "5A"}).json()["id"]
    assert other_establishment_client.get(f"/api/classes/{cid}").status_code == 404
    assert other_establishment_client.get("/api/classes").json() == []
    assert other_establishment_client.delete(f"/api/classes/{cid}").status_code == 404
    # autre enseignant du même établissement : pas d'accès non plus
    colleague = make_client(sub="teacher-3", establishment=1)
    assert colleague.get(f"/api/classes/{cid}").status_code == 404
    # un administrateur d'établissement y accède
    admin = make_client(sub="admin", establishment=1, roles=("establishment_admin",))
    assert admin.get(f"/api/classes/{cid}").status_code == 200


def test_unauthenticated_requests_rejected():
    from fastapi.testclient import TestClient

    from app.main import create_app

    assert TestClient(create_app()).get("/api/classes").status_code == 401


class _Verifier(TokenVerifier):
    def __init__(self, settings, key):
        self.settings, self._key = settings, key

    def signing_key(self, token):
        return self._key.public_key()


@pytest.fixture
def keypair():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _token(key, **over):
    claims = {
        "sub": "u1",
        "iss": "http://kc/realms/classmind",
        "aud": "classmind-api",
        "exp": int(time.time()) + 300,
        "establishment_id": "7",
        "realm_access": {"roles": ["teacher"]},
    } | over
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="RS256")


def test_jwt_verification(keypair):
    s = Settings(oidc_issuer="http://kc/realms/classmind")
    v = _Verifier(s, keypair)
    p = v.verify(_token(keypair))
    assert (p.sub, p.establishment_id) == ("u1", 7)
    for bad in (
        _token(keypair, exp=int(time.time()) - 10),
        _token(keypair, aud="autre"),
        _token(keypair, iss="http://evil"),
        _token(rsa.generate_private_key(public_exponent=65537, key_size=2048)),
    ):
        with pytest.raises(HTTPException) as e:
            v.verify(bad)
        assert e.value.status_code == 401
    for bad in (_token(keypair, establishment_id=None), _token(keypair, realm_access={"roles": []})):
        with pytest.raises(HTTPException) as e:
            v.verify(bad)
        assert e.value.status_code == 403

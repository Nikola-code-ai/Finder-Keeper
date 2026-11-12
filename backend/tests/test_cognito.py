import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

import app.auth as auth
from app.config import Settings, settings

POOL, CLIENT, REGION = "us-east-2_TestPool", "test-client-id", "us-east-2"
ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{POOL}"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(**overrides):
    now = int(time.time())
    claims = {"sub": "reader-sub", "aud": CLIENT, "iss": ISSUER, "token_use": "id", "iat": now, "exp": now + 900,
              "email": "reader@example.org", "email_verified": True, **overrides}
    return jwt.encode(claims, KEY, algorithm="RS256", headers={"kid": "k1"})


@pytest.fixture
def cognito(monkeypatch):
    monkeypatch.setattr(settings, "auth_mode", "cognito")
    monkeypatch.setattr(settings, "aws_region", REGION)
    monkeypatch.setattr(settings, "cognito_user_pool_id", POOL)
    monkeypatch.setattr(settings, "cognito_client_id", CLIENT)
    signing = type("Key", (), {"key": KEY.public_key()})()
    monkeypatch.setattr(auth, "_jwks", type("JWKS", (), {"get_signing_key_from_jwt": lambda _, t: signing})())


def test_cognito_id_token_opens_the_readers_own_library(client, cognito):
    response = client.get("/api/library", headers={"Authorization": f"Bearer {token()}"})
    assert response.status_code == 200, response.text
    folder = client.post("/api/folders", json={"name": "Mine"}, headers={"X-User-Authorization": f"Bearer {token()}"}).json()
    other = client.get("/api/library", headers={"Authorization": f"Bearer {token(sub='someone-else')}"}).json()
    assert folder["id"] not in str(other)


@pytest.mark.parametrize("bad", [
    {"aud": "another-client"},
    {"iss": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_Other"},
    {"token_use": "access"},
    {"exp": int(time.time()) - 10},
])
def test_cognito_rejects_wrong_or_expired_tokens(client, cognito, bad):
    assert client.get("/api/library", headers={"Authorization": f"Bearer {token(**bad)}"}).status_code == 401


def test_cognito_rejects_a_token_signed_by_another_key(client, cognito):
    forged = jwt.encode(jwt.decode(token(), options={"verify_signature": False}),
                        rsa.generate_private_key(public_exponent=65537, key_size=2048), algorithm="RS256")
    assert client.get("/api/library", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    assert client.get("/api/library").status_code == 401


def test_unverified_addresses_are_not_used_for_sharing(cognito):
    assert "email" not in auth.verify_cognito(token(email_verified=False))
    assert auth.verify_cognito(token())["email"] == "reader@example.org"


def test_cognito_production_configuration():
    base = dict(app_env="production", storage_backend="s3", s3_bucket_name="b", jobs_queue_url="q",
                database_url="postgresql://finder_keeper@h:5432/d")
    Settings(auth_mode="cognito", aws_region=REGION, cognito_user_pool_id=POOL, cognito_client_id=CLIENT, **base).validate_runtime()
    with pytest.raises(RuntimeError, match="COGNITO"):
        Settings(auth_mode="cognito", aws_region=REGION, **base).validate_runtime()
    with pytest.raises(RuntimeError, match="Production requires"):
        Settings(auth_mode="local", **base).validate_runtime()

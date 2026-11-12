import ipaddress

from fastapi import HTTPException, Request

from .config import settings


def current_email(request: Request) -> str:
    """The signed-in address, for sharing between friends. Local mode has one user."""
    if settings.auth_mode == "local":
        return "local-user@local"
    claims = getattr(request.state, "claims", None) or {}
    return (claims.get("email") or "").lower()


def current_owner(request: Request) -> str:
    if settings.auth_mode == "local":
        if settings.app_env == "production":
            raise HTTPException(503, "Local authentication is disabled in production")
        try:
            local_peer = ipaddress.ip_address(request.client.host).is_loopback
        except (ValueError, AttributeError):
            local_peer = False
        host = request.url.hostname
        if not local_peer or host not in {"localhost", "127.0.0.1", "::1"}:
            raise HTTPException(403, "Local library access is restricted to this computer")
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") not in settings.allowed_origins.split(","):
            raise HTTPException(403, "This origin cannot access the local library")
        return "local-user"
    # Behind an IAM-signed AWS proxy, SigV4 occupies Authorization and the user's token travels alongside it.
    token = request.headers.get("x-user-authorization") or request.headers.get("authorization", "")
    if not token.startswith("Bearer "):
        raise HTTPException(401, "Sign in to access your library")
    if settings.auth_mode == "cognito":
        claims = verify_cognito(token[7:])
        request.state.claims = claims
        return claims["sub"]
    try:
        import firebase_admin
        from firebase_admin import auth
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
        # The revocation lookup needs Google service credentials, which an AWS deployment does not carry.
        claims = auth.verify_id_token(token[7:], check_revoked=settings.firebase_check_revoked)
        request.state.claims = claims
        return claims["uid"]
    except Exception:
        raise HTTPException(401, "Your sign-in has expired. Please sign in again.") from None


_jwks = None


def verify_cognito(token: str) -> dict:
    """Verify a Cognito user pool ID token: signature (JWKS), issuer, audience, expiry and token use."""
    global _jwks
    import jwt
    issuer = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}"
    try:
        if _jwks is None:
            _jwks = jwt.PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True, lifespan=3600)
        key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=settings.cognito_client_id, issuer=issuer,
                            options={"require": ["exp", "iat", "sub", "aud", "iss", "token_use"]})
        if claims.get("token_use") != "id":
            raise ValueError("Not an ID token")
    except Exception:
        raise HTTPException(401, "Your sign-in has expired. Please sign in again.") from None
    # Sharing goes by address, so only a verified address counts.
    if not claims.get("email_verified"):
        claims.pop("email", None)
    return claims


def verify_worker(request: Request):
    token = request.headers.get("authorization", "")
    if not settings.tasks_service_account or not token.startswith("Bearer "):
        raise HTTPException(401, "Worker identity is required")
    try:
        from google.auth.transport.requests import Request as GoogleRequest
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(token[7:], GoogleRequest(), audience=settings.worker_url)
        if claims.get("email") != settings.tasks_service_account or not claims.get("email_verified"):
            raise ValueError("Unexpected worker identity")
    except Exception:
        raise HTTPException(403, "Invalid worker identity") from None

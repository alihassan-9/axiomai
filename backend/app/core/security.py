"""JWT issuance/validation, password hashing, and token revocation."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import redis.asyncio as aioredis
import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis_client import make_async_redis

log = structlog.get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = make_async_redis()
    return _redis


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(subject: str, token_type: Literal["access", "refresh"], expires_delta: timedelta,
                  extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + expires_delta,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, org_id: str, role: str) -> str:
    return _create_token(user_id, "access", timedelta(minutes=settings.access_token_expire_minutes),
                         {"org_id": org_id, "role": role})


def create_refresh_token(user_id: str) -> str:
    return _create_token(user_id, "refresh", timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_type: Literal["access", "refresh"]) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on any failure."""
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise JWTError(f"Expected {expected_type} token")
    return payload


async def revoke_token(payload: dict[str, Any]) -> None:
    """Add a token's jti to the Redis denylist until its natural expiry.

    Best-effort: if Redis is unreachable the logout simply isn't enforced
    server-side (the short-lived token still expires on its own) rather than
    failing the request."""
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        return
    ttl = max(1, int(exp - datetime.now(timezone.utc).timestamp()))
    try:
        await get_redis().setex(f"revoked:{jti}", ttl, "1")
    except RedisError as exc:
        log.warning("token_revoke_failed_redis_down", error=str(exc))


async def is_token_revoked(payload: dict[str, Any]) -> bool:
    jti = payload.get("jti")
    if not jti:
        return True
    try:
        return bool(await get_redis().exists(f"revoked:{jti}"))
    except RedisError as exc:
        # Fail open: a Redis outage shouldn't 500 every authenticated request.
        # Access tokens are short-lived (15 min), so the exposure window is small.
        log.warning("revocation_check_skipped_redis_down", error=str(exc))
        return False

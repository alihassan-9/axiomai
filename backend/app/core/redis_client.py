"""Redis client factory with an in-process fake backend for local dev.

Set ``REDIS_URL=memory://`` to use fakeredis — a pure-Python Redis emulator that
needs no server, no Docker, and no cloud. Any other URL connects to a real Redis,
so production is unaffected.

All fake clients share one ``FakeServer`` so the sync publisher and the async SSE
subscriber see the same keys and pub/sub channels within a single process. This
only works when everything runs in one process, i.e. with
``INLINE_AUDIT_EXECUTION=true`` (no separate Celery worker).
"""
from app.core.config import settings

_USE_FAKE = settings.redis_url.startswith("memory://")
_fake_server = None  # shared FakeServer, created lazily


def using_fake_redis() -> bool:
    return _USE_FAKE


def _server():
    global _fake_server
    if _fake_server is None:
        import fakeredis
        _fake_server = fakeredis.FakeServer()
    return _fake_server


def make_async_redis():
    if _USE_FAKE:
        import fakeredis.aioredis
        return fakeredis.aioredis.FakeRedis(server=_server(), decode_responses=True)
    import redis.asyncio as aioredis
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def make_sync_redis():
    if _USE_FAKE:
        import fakeredis
        return fakeredis.FakeStrictRedis(server=_server(), decode_responses=True)
    import redis
    return redis.from_url(settings.redis_url, decode_responses=True)

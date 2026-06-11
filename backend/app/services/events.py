"""Real-time audit progress events via Redis pub/sub (consumed by the SSE endpoint).

Publishers (Celery workers / inline pipeline) are synchronous; the SSE consumer
is async. Both sides share the `audit:{audit_id}` channel and JSON payloads:
    {"step": "extraction", "status": "running", "message": "...", "progress": 30}
A terminal event has step == "done" or step == "error".
"""
import json
from collections.abc import AsyncGenerator
from typing import Any

import redis as sync_redis
import redis.asyncio as aioredis

from app.core.config import settings

_sync_client: sync_redis.Redis | None = None


def get_sync_redis() -> sync_redis.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = sync_redis.from_url(settings.redis_url, decode_responses=True)
    return _sync_client


def publish_progress(audit_id: str, step: str, status: str, message: str = "",
                     progress: int = 0, extra: dict[str, Any] | None = None) -> None:
    payload = {"step": step, "status": status, "message": message, "progress": progress}
    if extra:
        payload.update(extra)
    client = get_sync_redis()
    client.publish(f"audit:{audit_id}", json.dumps(payload))
    # Keep last event so late subscribers see current state.
    client.setex(f"audit:{audit_id}:last", 3600, json.dumps(payload))


async def subscribe_progress(audit_id: str) -> AsyncGenerator[dict[str, Any], None]:
    client = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(f"audit:{audit_id}")
    try:
        last = await client.get(f"audit:{audit_id}:last")
        if last:
            yield json.loads(last)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            event = json.loads(message["data"])
            yield event
            if event.get("step") in ("done", "error"):
                break
    finally:
        await pubsub.unsubscribe(f"audit:{audit_id}")
        await client.aclose()

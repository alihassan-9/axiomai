"""FastAPI application entrypoint."""
import time

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, audit, auth, chat, compliance, documents, reports
from app.core.config import settings
from app.core.security import get_redis

log = structlog.get_logger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="AI-Powered Financial Compliance & Invoice Audit Platform",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    """Sliding-window rate limit per client (org when authenticated, IP otherwise)."""
    if request.url.path.startswith("/api/"):
        identity = getattr(request.state, "org_id", None) or (request.client.host if request.client else "anon")
        key = f"ratelimit:{identity}:{int(time.time() // 60)}"
        try:
            redis = get_redis()
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, 90)
            if count > settings.rate_limit_per_minute:
                return JSONResponse({"detail": "Rate limit exceeded"},
                                    status_code=status.HTTP_429_TOO_MANY_REQUESTS)
        except Exception as exc:  # noqa: BLE001 - Redis outage must not take the API down
            log.warning("rate_limit_check_failed", error=str(exc))
    return await call_next(request)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.app_name, "version": "1.0.0"}


for router in (auth.router, documents.router, audit.router, compliance.router,
               reports.router, admin.router, chat.router):
    app.include_router(router, prefix=settings.api_v1_prefix)

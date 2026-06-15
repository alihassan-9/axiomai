# Deployment Guide

## Local / staging — Docker Compose

```bash
# 1. Secrets (anything beyond local dev)
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" > .env

# 2. Build & start all 7 services
docker compose up --build -d

# 3. Pull models (one-time; ~5 GB)
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull bge-m3

# 4. Verify
curl http://localhost:8000/api/health
```

Services: `postgres`, `redis`, `minio`, `ollama`, `api` (FastAPI, 4 gunicorn workers),
`worker` (Celery), `frontend` (Next.js standalone). The API container runs
`scripts/init_db.py` on boot (idempotent schema creation).

## Database migrations

Schema changes flow through Alembic:

```bash
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

`alembic/env.py` reads `DATABASE_SYNC_URL` and imports all models, so autogenerate
diffs the live DB against `app/models`.

## Production checklist (V1)

**Secrets & config**
- [ ] `JWT_SECRET_KEY` from the environment / a secret manager, never baked into images
- [ ] Real Postgres credentials; TLS (`?sslmode=require`)
- [ ] MinIO → S3 with IAM credentials, or harden MinIO (non-default root user, TLS)
- [ ] `ENVIRONMENT=production`, `CORS_ORIGINS` = exact frontend origin only

**Scaling**
- API is stateless — run multiple replicas behind a reverse proxy.
- Workers scale independently (`--concurrency` and replica count); audit throughput is
  worker-bound, not API-bound.
- Ollama needs a GPU for good latency, or set `LLM_ENABLED=false` (deterministic mode
  remains fully functional — extraction + math + rule engine still run).
- FAISS indexes live on the shared `vectorstore` volume — use RWX storage when running
  multiple workers. (pgvector is the documented path if you later want shared state.)

**Monitoring**
- Structured JSON logs (structlog).
- The `audit_log` table is the compliance trail — back it up and never prune in place.

> Beyond V1 (not required to ship): Kubernetes/HPA, an API gateway, Prometheus metrics,
> and a managed Postgres/Redis. The Compose stack above is the supported V1 target.

## CI

`.github/workflows/ci.yml`: backend (ruff + pytest), frontend (tsc + eslint + next build),
then a compose build.

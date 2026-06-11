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

## Production checklist

**Secrets & config**
- [ ] `JWT_SECRET_KEY` from a secret manager (Vault / AWS SSM), never in images
- [ ] Real Postgres credentials; TLS (`?sslmode=require`)
- [ ] MinIO → S3 with IAM credentials, or harden MinIO (non-default root user, TLS)
- [ ] `ENVIRONMENT=production`, `CORS_ORIGINS` = exact frontend origin only

**Scaling**
- API is stateless — scale horizontally behind a load balancer / ingress.
- Workers scale independently (`--concurrency` and replica count); audit throughput is
  worker-bound, not API-bound.
- Ollama needs GPU for production latency; or set `ANTHROPIC_API_KEY` path / disable with
  `LLM_ENABLED=false` (deterministic mode remains fully functional).
- FAISS indexes live on the shared `vectorstore` volume — use RWX storage (EFS) when
  running multiple workers, or move to pgvector for fully shared state.

**Kubernetes sketch**
- Deployments: `frontend` (3), `api` (4, HPA 2–10), `worker` (2, HPA 1–8)
- StatefulSets: postgres (managed RDS preferred), redis (or ElastiCache)
- Ingress: TLS via cert-manager; route `/api/*` → api service, rest → frontend
- Liveness: `GET /api/health`; worker liveness via `celery inspect ping`

**Monitoring**
- Structured JSON logs (structlog) → Loki/CloudWatch
- Add Prometheus FastAPI middleware + celery-exporter; alert on queue depth and
  audit failure rate
- The `audit_log` table is the compliance trail — back it up and never prune in place

## CI

`.github/workflows/ci.yml`: backend (ruff + pytest), frontend (tsc + eslint + next build),
then a compose build. Wire deployment (push to registry + `kubectl rollout`) into the
`docker` job for your environment.

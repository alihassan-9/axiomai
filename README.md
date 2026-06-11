# Neuro-Symbolic Financial Auditor

AI-powered B2B SaaS that audits vendor invoices automatically: **neural extraction** (OCR + LLM)
reads messy documents, **symbolic math** (SymPy/Decimal) recomputes every figure exactly, and
**RAG over your policy documents** flags compliance violations — all with line-level citations
and an explainable narrative.

> Upload an invoice → 5-agent pipeline runs in seconds → "$45.00 overcharge on line 1:
> 8 × $30.00 = $240.00, invoice states $285.00" with the policy clause that applies.

## Stack

| Tier | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, React 19, Tailwind v4), TanStack Query, Zustand, Recharts |
| API | FastAPI (Python 3.11, async SQLAlchemy 2.0), JWT + RBAC, SSE streaming |
| Workers | Celery + Redis (audit pipeline, policy indexing) |
| AI | LangGraph 5-agent state machine, Ollama (Llama 3.1 + bge-m3), SymPy, FAISS, Tesseract |
| Data | PostgreSQL 16, Redis 7, MinIO (S3), per-org FAISS vector indexes |
| Ops | Docker Compose, GitHub Actions CI, structured logging |

## Quick start (Docker)

```bash
docker compose up --build -d
# optional but recommended — enables LLM extraction, RAG evaluation, narratives:
docker compose exec ollama ollama pull llama3.1
docker compose exec ollama ollama pull bge-m3
```

- App: http://localhost:3000 — register an organisation (first user becomes admin)
- API docs (OpenAPI): http://localhost:8000/api/docs
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

The platform degrades gracefully without Ollama: deterministic extraction, exact math audit,
and the structured rule engine all still work; only LLM re-extraction, RAG evaluation, and
prose narratives are skipped.

## Local development

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt pytest
copy .env.example .env                            # adjust as needed
python scripts/init_db.py
uvicorn app.main:app --reload                     # http://localhost:8000

# Worker (or set INLINE_AUDIT_EXECUTION=true to skip)
celery -A app.workers.celery_app:celery_app worker --loglevel=INFO --pool=solo

# Frontend
cd frontend
npm install
npm run dev                                       # http://localhost:3000 (proxies /api/v1 to :8000)
```

Infrastructure for local dev: `docker compose up postgres redis minio -d`.

## Demo dataset

```bash
cd backend && python scripts/generate_demo_data.py
```

Creates `backend/demo_data/` with 5 mock invoices (clean / $45 overcharge / tax error /
policy violation / messy layout) and 2 policy PDFs. Upload the policies first, create the
"$500 software cap" rule in the Policy Manager, then audit each invoice.

Offline pipeline check without any services: `python scripts/smoke_pipeline.py`.

## Tests

```bash
cd backend && pytest          # 20 unit tests: math audit, rule engine, extraction
cd frontend && npx tsc --noEmit && npm run lint
```

## The 5-agent pipeline

1. **Orchestrator** — LangGraph state machine; routes, retries, streams progress via Redis → SSE
2. **Extraction** — pdfplumber/Tesseract + LLM, grounding-confidence scoring against source text
3. **Math Audit** — exact SymPy/Decimal recomputation; one-cent discrepancies flagged with deltas
4. **Policy Compliance** — deterministic rule engine + FAISS RAG over uploaded policy PDFs
5. **Correction & Explainer** — re-extracts low-confidence fields when math fails; writes narrative

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, data flows, schema
- [docs/API.md](docs/API.md) — all ~34 REST endpoints
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deployment, scaling, security checklist

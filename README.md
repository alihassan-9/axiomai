# Axiom AI

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
| AI | Google ADK 5-agent pipeline, Ollama (Llama 3.1 + bge-m3), SymPy, FAISS, Tesseract |
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

## Evaluation

```bash
cd backend && python scripts/evaluate.py     # offline, deterministic — no LLM/DB needed
```

Runs 10 test cases over the demo invoices + targeted unit checks and regenerates
`submission/05_Prompts_and_Evaluation/expected_vs_actual_results.{csv,md}`. Expected output:

```
PASS 9/10  |  KNOWN-LIMITATION 1  |  FAIL 0
TC2  Line-item overcharge … expected $45.00 overcharge … actual $45.00   [PASS]
TC5  Messy free-text layout … deterministic parser extracted 0 line items [KNOWN-LIMITATION]
```

Test-case definitions, the prompt library, and error analysis live in
[`submission/05_Prompts_and_Evaluation/`](submission/05_Prompts_and_Evaluation/).

## Tests

```bash
cd backend && pytest          # unit tests: math audit, rule engine, extraction
cd frontend && npx tsc --noEmit && npm run lint
```

## Project structure

```
GenAI Project/
├── backend/                 # FastAPI service (Python 3.11)
│   ├── app/
│   │   ├── agents/          # 5-agent pipeline: extraction, math_audit, policy_compliance,
│   │   │                    #   correction, report (+ orchestrator, state)
│   │   ├── ai/              # llm.py (Ollama), vector_store.py (FAISS RAG), pdf_text.py
│   │   ├── api/v1/          # auth, documents, audit, compliance, reports, admin
│   │   ├── core/            # config, database, security, deps, redis_client
│   │   ├── models/          # SQLAlchemy ORM (8 multi-tenant tables)
│   │   ├── schemas/         # Pydantic request/response models
│   │   └── services/        # events (SSE), audit_trail, storage
│   ├── scripts/             # init_db, generate_demo_data, smoke_pipeline, evaluate
│   ├── demo_data/           # 5 demo invoices + 2 policy PDFs
│   └── .env.example
├── frontend/                # Next.js 16 app (React 19, Tailwind v4)
│   └── src/{app,components,lib,stores,utils}/
├── docs/                    # ARCHITECTURE.md, API.md, DEPLOYMENT.md
├── submission/              # Capstone deliverables (report, slides, prompts, evaluation)
└── docker-compose.yml
```

## Configuration

All settings come from environment variables — see [`backend/.env.example`](backend/.env.example)
(backend) and [`frontend/.env.local.example`](frontend/.env.local.example) (browser Supabase
keys for Google sign-in). **No real secrets are committed**; copy the examples and fill in your
own. Key choices: `REDIS_URL=memory://` for zero-infra dev; `DATABASE_URL` for local Docker
Postgres or a Supabase pooler; leave `SUPABASE_URL` blank to disable Google sign-in.

## Known issues & troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Connect call failed … :5432` | Postgres not reachable. Start `docker compose up postgres -d`, or use a Supabase **session pooler** URL (the direct `db.<ref>.supabase.co` host is IPv6-only and fails on many networks). |
| `… asyncpg … Invalid` on Supabase | URL-encode `@` in the password as `%40` and keep the `+asyncpg` driver + `?ssl=require`. |
| `revocation_check_skipped_redis_down` spam | Redis isn't running. Set `REDIS_URL=memory://` (in-process) or start `docker compose up redis -d`. |
| `error reading bcrypt version` | Harmless with `bcrypt==4.0.1` (pinned); older 4.1+ breaks passlib 1.7.4's version probe. |
| Google sign-in returns to login | In Supabase → Auth → URL Configuration add `http://localhost:3000/auth/callback` and set Site URL `http://localhost:3000`. |
| Messy invoice extracts 0 line items | Expected offline — start Ollama (`ollama pull llama3.1`) so the LLM extraction path runs. |

## The 5-agent pipeline

Orchestrated by a Google ADK `SequentialAgent` (control flow only — streams progress via Redis → SSE):

1. **Document Intelligence (Extraction)** — pdfplumber/Tesseract + LLM, grounding-confidence scoring against source text
2. **Math Audit** — exact SymPy/Decimal recomputation; one-cent discrepancies flagged with deltas (no LLM)
3. **Policy Compliance** — deterministic rule engine + FAISS RAG over uploaded policy PDFs
4. **Correction** — re-extracts low-confidence fields only when math fails; the symbolic audit re-runs as arbiter
5. **Report** — executive summary / explainable narrative (LLM with deterministic template fallback)

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, data flows, schema
- [docs/API.md](docs/API.md) — all ~34 REST endpoints
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deployment, scaling, security checklist

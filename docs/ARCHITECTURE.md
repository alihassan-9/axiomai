# Architecture

## Tiers

```
Browser (Next.js 16 SPA/SSR)
   │  /api/v1/* proxied by Next rewrites (reverse proxy in prod)
   ▼
FastAPI (async)  ──── JWT auth · RBAC · rate limit · org scoping
   │ enqueue                                │ SSE (Redis pub/sub)
   ▼                                        ▼
Celery worker ── Google ADK 5-agent pipeline ── progress events
   │
   ├── PostgreSQL 16   (8 tables, multi-tenant via org_id)
   ├── Redis 7         (broker, cache, rate limit, pub/sub, token denylist)
   ├── MinIO           (raw PDFs, presigned 15-min URLs)
   ├── FAISS           (per-org policy vector index, disk-persisted)
   └── Ollama          (Llama 3.1 generation, bge-m3 embeddings)
```

## Repository layout

```
backend/
  app/
    core/        config, async DB session, JWT/security, deps (auth+RBAC)
    models/      8 SQLAlchemy models (organisations, users, documents,
                 extractions, audits, violations, policies, audit_log)
    schemas/     Pydantic request/response contracts
    api/v1/      auth, documents, audit, compliance, reports, admin routers
    agents/      orchestrator (Google ADK SequentialAgent) + 5 agents:
                 extraction, math_audit, policy_compliance, correction, report
                 — pure functions over AuditState, one responsibility each
    ai/          pdf_text (pdfplumber/OCR), llm (Ollama client), vector_store (FAISS)
    services/    storage (MinIO), events (Redis pub/sub), audit_trail,
                 audit_runner (worker-side DB orchestration)
    workers/     Celery app + tasks
  alembic/       migration environment (autogenerate-ready)
  scripts/       init_db, generate_demo_data, smoke_pipeline
  tests/         20 unit tests (no infrastructure required)
frontend/
  src/app/       11 routes: landing, auth/{login,register}, dashboard, upload,
                 audits, audit/[id], compliance, reports, settings, admin
  src/components ui kit, app shell (sidebar/RBAC nav), providers
  src/lib/       axios client w/ refresh rotation, SSE hook, types
  src/stores/    zustand auth store
```

## Audit data flow

1. `POST /audit/run` validates org ownership, inserts `audits` row, commits, dispatches Celery task.
2. Worker downloads the PDF from MinIO, extracts text (pdfplumber → Tesseract fallback).
3. Google ADK runs: extraction → math_audit → policy_check → correction → report.
   A `SequentialAgent` (supervisor) drives five workflow sub-agents sharing the
   ADK session state (= `AuditState`); each emits an event and publishes an
   `audit:{id}` progress event to Redis. Correction (Agent 4) re-extracts only
   when math fails on low-confidence data; Report (Agent 5) writes the narrative.
4. `GET /audit/{id}/stream` (SSE) replays the last event then relays the channel live.
5. Results persist: `extractions`, `violations` (one row per finding), `audits.findings_json`,
   `narrative`, `savings_amount`.

## Key design decisions

- **Symbolic source of truth.** LLM output is never trusted for arithmetic: every relation is
  recomputed with SymPy rationals + Decimal; tolerance is 1 cent. `savings_amount` counts only
  overcharges.
- **Grounding confidence.** Extraction confidence = fraction of extracted numbers literally
  present in the source text. The Correction agent only accepts a re-extraction if it is at
  least as grounded *and* removes severe math findings — hallucinated "fixes" are rejected.
- **Hard vs. soft compliance.** Structured rules (JSON, deterministic) produce hard violations
  with exact citations. RAG+LLM findings are capped at severity `medium` and labelled
  `rag-llm` — advisory, never audit-grade on their own.
- **Graceful AI degradation.** No Ollama → deterministic extraction, template narratives,
  hash-based embeddings. The audit pipeline never hard-fails because a model is down.
- **Multi-tenancy.** Every tenant table carries `org_id`; every query in the API layer scopes
  on the authenticated user's org. Object keys and FAISS indexes are org-prefixed.
- **Token security.** 15-min access / 7-day refresh JWTs; refresh rotation with Redis jti
  denylist; logout revokes. RBAC: admin / analyst / viewer (viewer is read-only).

## Database schema (core columns)

| Table | Purpose | Notable columns |
|---|---|---|
| organisations | tenant root | plan_tier |
| users | identity + RBAC | email (unique), role, password_hash (bcrypt) |
| documents | upload registry | type (invoice/policy), s3_key, status |
| extractions | structured invoice JSON | raw_json, confidence, method |
| audits | audit runs | status, findings_json, narrative, savings_amount |
| violations | individual findings | category (math/policy), severity, detail_json |
| policies | structured rules | rule_json {rules:[…]}, is_active |
| audit_log | immutable trail | action, entity, ip_address, timestamp |

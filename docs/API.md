# API Reference

Base URL: `/api/v1` · Auth: `Authorization: Bearer <access_token>` · Interactive docs: `/api/docs`

Roles: **admin** (everything), **analyst** (mutations except admin), **viewer** (read-only).

## Auth — `/auth`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | /auth/register | — | Create organisation + first admin user; returns token pair |
| POST | /auth/login | — | Issue access (15 min) + refresh (7 d) tokens |
| POST | /auth/refresh | — | Rotate refresh token (old one revoked) |
| POST | /auth/logout | any | Revoke the presented access token |
| GET | /auth/me | any | Current user profile |
| PUT | /auth/me | any | Update name / password |

## Documents — `/documents`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | /documents/upload | analyst | Multipart invoice upload (PDF/PNG/JPG, ≤25 MB) |
| POST | /documents/policy/upload | analyst | Policy PDF → chunked + embedded into org RAG index |
| GET | /documents | any | List org documents (`?type=invoice\|policy`) |
| GET | /documents/{id} | any | Metadata + processing status |
| GET | /documents/{id}/preview | any | 15-min presigned URL for in-browser rendering |
| GET | /documents/{id}/extracted | any | Latest structured extraction JSON |
| DELETE | /documents/{id} | analyst | Soft delete (+ vector index removal for policies) |

## Audit — `/audit`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | /audit/run | analyst | Trigger 5-agent pipeline (202; body `{doc_id}`) |
| GET | /audit | any | Paginated list (`page`, `page_size`, `status_filter`) |
| GET | /audit/{id} | any | Full report incl. violations |
| GET | /audit/{id}/stream | any | SSE progress events (`step`, `status`, `progress`) |
| POST | /audit/{id}/rerun | analyst | Re-audit same document with current policies |
| GET | /audit/{id}/export?format=csv\|pdf | any | Download report |

## Compliance — `/compliance`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | /compliance/policies | any | List structured policies |
| POST | /compliance/policies | analyst | Create policy with rules (see below) |
| PUT | /compliance/policies/{id} | analyst | Update name/rules/active flag |
| DELETE | /compliance/policies/{id} | analyst | Remove policy |
| POST | /compliance/check | any | Evaluate an invoice JSON without a full audit |
| GET | /compliance/violations | any | Historical violation log |

Rule shape (a rule states the **violation condition**):

```json
{
  "field": "line_items[].line_total",
  "operator": "gt",
  "value": 500,
  "when": {"category": "Software"},
  "severity": "high",
  "message": "Software spend cap is $500 per invoice"
}
```

Operators: `lt lte gt gte eq neq in not_in contains`. `line_items[].x` applies per line.

## Reports — `/reports`

| Method | Path | Description |
|---|---|---|
| GET | /reports/summary | Totals, compliance score, savings, document count |
| GET | /reports/trends?days=30 | Daily audits / violations / savings series |
| GET | /reports/savings | Top recoveries with audit links |
| GET | /reports/vendor/{name} | Per-vendor history and discrepancy stats |
| POST | /reports/export?days=30 | CSV of audits in range |

## Admin — `/admin` (admin only)

| Method | Path | Description |
|---|---|---|
| GET | /admin/users | Org members |
| POST | /admin/users/invite | Create member with one-time temporary password |
| PUT | /admin/users/{id}/role | Change RBAC role (self-demotion blocked) |
| GET | /admin/usage | Documents, audits, storage bytes, plan tier |
| GET | /admin/audit-log | Immutable system audit trail |

## Errors

Standard FastAPI shape `{"detail": "..."}` with 401 (unauthenticated/expired), 403 (RBAC),
404 (not found or cross-org access), 409 (conflict), 413/415/422 (upload validation),
429 (rate limit — 100 req/min/org).

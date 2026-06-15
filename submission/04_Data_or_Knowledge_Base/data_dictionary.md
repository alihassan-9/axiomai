# Data Dictionary — Axiom AI

## A. Extracted invoice schema (the unit of analysis)

Produced by the Extraction agent (`backend/app/agents/extraction.py`); verified by the Math
Audit agent.

| Field | Type | Description |
|-------|------|-------------|
| `vendor` | string | Vendor / biller name |
| `invoice_number` | string | Invoice identifier |
| `invoice_date` | string | Invoice date as printed |
| `currency` | string | Currency code (default USD) |
| `line_items[]` | array | One object per line (below) |
| `line_items[].description` | string | Item description |
| `line_items[].category` | string | Spend category (e.g. Software, Meals) |
| `line_items[].quantity` | number | Units billed |
| `line_items[].unit_price` | number | Price per unit (as stated) |
| `line_items[].line_total` | number | Line total **as stated** (may be wrong — copied verbatim) |
| `subtotal` | number\|null | Stated subtotal |
| `tax_rate` | number\|null | Decimal fraction (8.5% → 0.085) |
| `tax_amount` | number\|null | Stated tax amount |
| `grand_total` | number\|null | Stated grand total |

## B. Database tables (PostgreSQL/Supabase — `backend/app/models/__init__.py`)

8 multi-tenant tables; every tenant-owned row carries an indexed `org_id`.

| Table | Purpose | Key fields |
|-------|---------|-----------|
| `organisations` | Tenant | id, name, plan_tier, created_at |
| `users` | Members | id, org_id, email, full_name, role (admin/analyst/viewer), password_hash, is_active |
| `documents` | Uploaded files | id, org_id, uploaded_by, type (invoice/policy), filename, content_type, s3_key, status, error |
| `extractions` | Extracted invoice JSON | id, org_id, doc_id, (structured invoice payload) |
| `audits` | Audit runs | id, org_id, doc_id, triggered_by, status, findings_json, savings_amount, started_at, completed_at, error |
| `violations` | Policy findings | id, org_id, audit_id, rule_id, severity, message, location |
| `policies` | Policy docs + rules | id, org_id, name, rule_json, source_doc_id |
| `audit_log` | Audit trail | id, org_id, user_id, action, entity, entity_id, ip, timestamp |

## C. Policy rule schema (`policies.rule_json`)

Evaluated deterministically by the Policy Compliance agent.

| Field | Type | Description |
|-------|------|-------------|
| `field` | string | Target field, e.g. `grand_total` or `line_items[].line_total` |
| `operator` | string | `lt`/`lte`/`gt`/`gte`/`eq`/`neq`/`in`/`not_in`/`contains` |
| `value` | number/string/list | Threshold the rule compares against |
| `when` | object (optional) | Guard, e.g. `{"category": "Software"}` |
| `severity` | string | info/low/medium/high/critical |
| `message` | string | Human-readable violation message |

## D. Audit finding schema (Math Audit output)

| Field | Type | Description |
|-------|------|-------------|
| `check` | string | What was verified, e.g. `tax = subtotal × tax_rate` |
| `expected` | number | Symbolically recomputed value |
| `actual` | number | Value stated on the invoice |
| `delta` | number | actual − expected (signed) |
| `severity` | string | high / critical / medium |
| `citation` | string | Line/source reference |
| `formula` | string | Human-readable computation |

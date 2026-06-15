# Deployment Proof — Screenshot Checklist

Run the app locally, capture each shot below into `06_Deployment_Proof/screenshots/`, and use
the suggested filenames. This satisfies the §10 "screenshots and run commands as proof"
requirement (cloud hosting is only *recommended*, so local proof is enough).

## Run commands (capture the terminals too)

```bash
# Backend (terminal 1)
cd backend && uvicorn app.main:app --reload          # shows "Application startup complete"

# Frontend (terminal 2)
cd frontend && npm run dev                            # shows "Ready" on http://localhost:3000

# Evaluation (terminal 3)
cd backend && python scripts/evaluate.py             # shows PASS 9/10 | KNOWN-LIMITATION 1 | FAIL 0
```

## Frontend / UI screenshots (the important ones)

| # | Filename | What to show |
|---|----------|--------------|
| 1 | `01_landing.png` | Landing page (hero + dashboard mock) |
| 2 | `02_login.png` | Login page (split card + Google sign-in) |
| 3 | `03_dashboard.png` | Dashboard — savings, compliance gauge, trends |
| 4 | `04_upload.png` | Upload an invoice / policy document |
| 5 | `05_audit_result.png` | **An audit result showing the $45.00 overcharge with its citation** (the money shot) |
| 6 | `06_policy_violation.png` | Audit showing a policy violation with the cited clause |
| 7 | `07_reports.png` | Reports / audit history page |

## Backend / proof screenshots

| # | Filename | What to show |
|---|----------|--------------|
| 8 | `08_api_docs.png` | OpenAPI docs at http://localhost:8000/api/docs |
| 9 | `09_evaluate_run.png` | Terminal output of `python scripts/evaluate.py` (PASS 9/10) |
| 10 | `10_backend_running.png` | uvicorn terminal: "Application startup complete" |
| 11 | `11_docker_ps.png` *(optional)* | `docker compose ps` if you run via Docker |

## Tips
- For shot #5, use `overcharge_invoice.pdf` from `backend/demo_data/` — it's the clearest result.
- Start Ollama (`ollama pull llama3.1`) before the demo if you want LLM narratives + messy-invoice
  extraction; otherwise the deterministic core still produces the audit.
- Optional: record a 1–2 min screen capture and drop the link in `06_Deployment_Proof/demo_video_link.txt`.

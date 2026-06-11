"""Offline smoke test: run extraction + math audit over the demo dataset."""
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.agents.extraction import deterministic_parse  # noqa: E402
from app.agents.math_audit import audit_invoice  # noqa: E402
from app.ai.pdf_text import extract_text  # noqa: E402

DEMO = os.path.join(os.path.dirname(__file__), "..", "demo_data")

for name in ["clean_invoice", "overcharge_invoice", "tax_error_invoice",
             "policy_violation_invoice", "messy_invoice"]:
    with open(os.path.join(DEMO, f"{name}.pdf"), "rb") as fh:
        data = fh.read()
    text, _ = extract_text(data, "application/pdf")
    invoice = deterministic_parse(text, data)
    findings, savings = audit_invoice(invoice)
    print(f"{name}: lines={len(invoice['line_items'])} findings={len(findings)} savings=${savings:.2f}")
    for finding in findings:
        print("   -", finding.get("formula", ""))

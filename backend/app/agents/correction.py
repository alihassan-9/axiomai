"""Agent 5 — Correction & Explainer.

Correction: when the math audit fails AND extraction confidence is low, the
mismatch is more likely a misread digit than a vendor error. The agent re-runs
a focused LLM extraction telling the model exactly which relations failed; if
the corrected values make the arithmetic balance AND are grounded in the
source text, the correction is accepted and the math audit re-runs.

Explainer: renders the human-readable audit narrative (LLM when available,
deterministic template otherwise — the report is never empty).
"""
import json

from app.agents import math_audit
from app.agents.state import AuditState
from app.ai import llm

CONFIDENCE_THRESHOLD = 0.8

_CORRECTION_SYSTEM = """You are re-checking an invoice extraction that failed arithmetic \
verification. The original OCR/extraction may have misread digits. Re-read the source text \
carefully and return the corrected full invoice JSON in the same schema. Copy values exactly \
from the text — do not invent numbers that are not present."""


def _try_correction(state: AuditState) -> bool:
    failed = [f["formula"] for f in state.get("math_findings", []) if "formula" in f]
    prompt = (
        f"SOURCE TEXT:\n{state['raw_text'][:12000]}\n\n"
        f"PREVIOUS EXTRACTION:\n{json.dumps(state['invoice'], default=str)}\n\n"
        f"FAILED CHECKS:\n- " + "\n- ".join(failed) +
        "\n\nReturn the corrected invoice JSON only."
    )
    result = llm.generate_json(prompt, system=_CORRECTION_SYSTEM)
    if not result or not isinstance(result.get("line_items"), list):
        return False

    from app.agents.extraction import _grounding_confidence, _sanitize
    corrected = _sanitize(result)
    if _grounding_confidence(corrected, state["raw_text"]) < state.get("extraction_confidence", 0):
        return False  # correction is less grounded than the original — reject
    findings, savings = math_audit.audit_invoice(corrected)
    old_severe = sum(1 for f in state.get("math_findings", []) if f.get("severity") in ("high", "critical"))
    new_severe = sum(1 for f in findings if f.get("severity") in ("high", "critical"))
    if new_severe < old_severe:
        state["invoice"] = corrected
        state["math_findings"] = findings
        state["savings_amount"] = savings
        state["math_passed"] = new_severe == 0
        state["extraction_method"] = state.get("extraction_method", "") + "+corrected"
        return True
    return False


def _template_narrative(state: AuditState) -> str:
    invoice = state.get("invoice", {})
    math_findings = state.get("math_findings", [])
    policy_findings = state.get("policy_findings", [])
    lines = [
        f"Audit report for invoice {invoice.get('invoice_number') or '(no number)'} "
        f"from {invoice.get('vendor') or 'unknown vendor'}.",
        f"Extracted {len(invoice.get('line_items', []))} line items "
        f"(method: {state.get('extraction_method', 'n/a')}, "
        f"confidence: {state.get('extraction_confidence', 0):.0%}).",
    ]
    severe = [f for f in math_findings if f.get("severity") in ("high", "critical")]
    if severe:
        lines.append(f"Mathematical verification FAILED — {len(severe)} discrepancies:")
        lines.extend(f"  • {f['citation']} (Δ {f.get('delta', 0):+.2f})" for f in severe)
        if state.get("savings_amount", 0) > 0:
            lines.append(f"Detected overcharge: ${state['savings_amount']:.2f}.")
    else:
        lines.append("All arithmetic verified correct via symbolic recomputation.")
    if policy_findings:
        lines.append(f"Policy compliance: {len(policy_findings)} violation(s):")
        lines.extend(f"  • [{f.get('severity', 'medium').upper()}] {f.get('message', '')} ({f.get('location', '')})"
                     for f in policy_findings)
    else:
        lines.append("No policy violations detected.")
    if state.get("corrected"):
        lines.append("Note: extraction was auto-corrected after failing initial verification.")
    return "\n".join(lines)


def run(state: AuditState) -> AuditState:
    needs_correction = (not state.get("math_passed", True)
                        and state.get("extraction_confidence", 1.0) < CONFIDENCE_THRESHOLD
                        and state.get("retries", 0) == 0)
    if needs_correction:
        state["retries"] = state.get("retries", 0) + 1
        state["corrected"] = _try_correction(state)

    template = _template_narrative(state)
    narrative = llm.generate(
        "Rewrite this audit report as 2-3 clear professional paragraphs for a finance manager. "
        "Keep every number exactly as stated. Do not add information.\n\n" + template,
        system="You are a senior financial auditor writing an audit summary.",
    )
    state["narrative"] = (narrative or template).strip()
    return state

"""Agent 4 — Correction: guarded re-extraction when the math audit fails.

When math verification fails AND extraction confidence is low, the mismatch is
more likely a misread digit than a real vendor error. This agent re-runs a
focused LLM extraction telling the model exactly which arithmetic relations
failed. The correction is accepted only if the new values are at least as
grounded in the source text AND remove severe math findings (the symbolic audit
is re-run to check). Hallucinated "fixes" are rejected — the deterministic math
check stays the arbiter. The human-readable narrative is produced separately by
the Report agent (Agent 5).

Inputs:  math_findings, invoice, raw_text, extraction_confidence (from state)
Output:  state["corrected"] (bool); may replace state["invoice"]/["math_findings"]
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


def run(state: AuditState) -> AuditState:
    needs_correction = (not state.get("math_passed", True)
                        and state.get("extraction_confidence", 1.0) < CONFIDENCE_THRESHOLD
                        and state.get("retries", 0) == 0)
    if needs_correction:
        state["retries"] = state.get("retries", 0) + 1
        state["corrected"] = _try_correction(state)
    return state

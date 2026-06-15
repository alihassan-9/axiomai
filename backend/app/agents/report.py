"""Agent 5 — Report: the human-readable, explainable audit narrative.

Renders the final report from the math and policy findings: an executive
summary, each discrepancy with its exact citation, the detected overcharge, and
any policy violations. The LLM rewrites the deterministic template into clean
prose when available; otherwise the template itself is the report — so the
output is never empty and every number stays exactly as verified.

Inputs:  math_findings, policy_findings, invoice, savings_amount (from state)
Output:  state["narrative"]
"""
from app.agents.state import AuditState
from app.ai import llm


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
    template = _template_narrative(state)
    narrative = llm.generate(
        "Rewrite this audit report as 2-3 clear professional paragraphs for a finance manager. "
        "Keep every number exactly as stated. Do not add information.\n\n" + template,
        system="You are a senior financial auditor writing an audit summary.",
    )
    state["narrative"] = (narrative or template).strip()
    return state

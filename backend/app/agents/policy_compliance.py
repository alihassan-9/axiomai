"""Agent 4 — Policy Compliance: deterministic rule engine + RAG over policy docs.

Two complementary mechanisms:
1. Structured rules (`policies.rule_json`) are evaluated deterministically —
   these produce hard violations with exact rule citations.
2. RAG retrieval over ingested policy PDFs (FAISS, per-org index) gives the
   LLM evaluator natural-language policy context; LLM-derived findings are
   marked `source: "rag-llm"` and never exceed severity "medium" on their own.
"""
import json
from typing import Any

from app.agents.state import AuditState
from app.ai import llm
from app.ai.vector_store import OrgVectorStore

_OPERATORS = {
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "eq": lambda a, b: a == b,
    "neq": lambda a, b: a != b,
    "in": lambda a, b: a in b,
    "not_in": lambda a, b: a not in b,
    "contains": lambda a, b: str(b).lower() in str(a).lower(),
}


def _matches_condition(record: dict[str, Any], when: dict[str, Any] | None) -> bool:
    if not when:
        return True
    return all(str(record.get(k, "")).lower() == str(v).lower() for k, v in when.items())


def _evaluate_rule(rule: dict[str, Any], invoice: dict[str, Any]) -> list[dict[str, Any]]:
    """A rule violates when its comparison is TRUE (rules describe violation conditions)."""
    field, op = rule.get("field", ""), rule.get("operator", "gt")
    compare = _OPERATORS.get(op)
    if compare is None:
        return []
    violations = []
    if field.startswith("line_items[]."):
        attr = field.split(".", 1)[1]
        for idx, item in enumerate(invoice.get("line_items", [])):
            if not _matches_condition(item, rule.get("when")):
                continue
            actual = item.get(attr)
            if actual is not None and _safe_compare(compare, actual, rule.get("value")):
                violations.append(_violation(rule, actual, f"line item {idx + 1}: "
                                             f"\"{item.get('description', '')[:60]}\""))
    else:
        if _matches_condition(invoice, rule.get("when")):
            actual = invoice.get(field)
            if actual is not None and _safe_compare(compare, actual, rule.get("value")):
                violations.append(_violation(rule, actual, f"invoice field '{field}'"))
    return violations


def _safe_compare(fn, actual: Any, value: Any) -> bool:
    try:
        if isinstance(value, (int, float)) and not isinstance(actual, (int, float)):
            actual = float(str(actual).replace(",", "").replace("$", ""))
        return bool(fn(actual, value))
    except (TypeError, ValueError):
        return False


def _violation(rule: dict[str, Any], actual: Any, location: str) -> dict[str, Any]:
    return {
        "source": "rule-engine",
        "severity": rule.get("severity", "medium"),
        "message": rule.get("message") or f"{rule.get('field')} {rule.get('operator')} {rule.get('value')}",
        "field": rule.get("field"),
        "operator": rule.get("operator"),
        "threshold": rule.get("value"),
        "actual": actual,
        "location": location,
    }


_RAG_SYSTEM = """You are a financial compliance analyst. Evaluate the invoice against the policy \
excerpts. Report only violations clearly supported by the quoted policy text. Output JSON:
{"violations": [{"message": string, "policy_quote": string, "severity": "low"|"medium"}]}"""


def _rag_check(org_id: str, invoice: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    categories = ", ".join({i.get("category", "") for i in invoice.get("line_items", []) if i.get("category")})
    query = (f"expense policy limits thresholds approval vendor {invoice.get('vendor', '')} "
             f"{categories} total {invoice.get('grand_total', '')}")
    chunks = OrgVectorStore(org_id).search(query, k=5)
    context = [c.text for c in chunks]
    if not context:
        return [], []
    result = llm.generate_json(
        "POLICY EXCERPTS:\n" + "\n---\n".join(context[:5]) +
        f"\n\nINVOICE JSON:\n{json.dumps(invoice, default=str)[:6000]}\n\nEvaluate now.",
        system=_RAG_SYSTEM,
    )
    findings = []
    if result and isinstance(result.get("violations"), list):
        for v in result["violations"][:10]:
            severity = v.get("severity", "low")
            findings.append({
                "source": "rag-llm",
                "severity": severity if severity in ("low", "medium") else "medium",
                "message": str(v.get("message", ""))[:500],
                "policy_quote": str(v.get("policy_quote", ""))[:500],
                "location": "policy document (RAG)",
            })
    return findings, context


def run(state: AuditState) -> AuditState:
    invoice = state.get("invoice", {})
    findings: list[dict[str, Any]] = []

    for policy in state.get("policies", []):
        for rule in policy.get("rule_json", {}).get("rules", []):
            for violation in _evaluate_rule(rule, invoice):
                violation["policy_id"] = policy.get("id")
                violation["policy_name"] = policy.get("name", "")
                findings.append(violation)

    rag_findings, context = _rag_check(state["org_id"], invoice)
    findings.extend(rag_findings)

    state["policy_findings"] = findings
    state["rag_context"] = context
    return state

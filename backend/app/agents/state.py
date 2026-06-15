"""Shared state passed between agents — this is the Google ADK session state.

ADK keeps it under ``session.state["audit"]``; each workflow agent reads it,
mutates its slice, and writes it back via an event ``state_delta``.
"""
from typing import Any, TypedDict


class AuditState(TypedDict, total=False):
    # Inputs
    audit_id: str
    org_id: str
    doc_id: str
    raw_text: str
    pdf_bytes: bytes
    content_type: str
    policies: list[dict[str, Any]]  # active structured policies (rule_json + ids)

    # Orchestrator
    retries: int

    # Extraction agent
    invoice: dict[str, Any]
    extraction_method: str
    extraction_confidence: float

    # Math audit agent
    math_findings: list[dict[str, Any]]
    savings_amount: float
    math_passed: bool

    # Policy compliance agent
    policy_findings: list[dict[str, Any]]
    rag_context: list[str]

    # Correction & explainer agent
    corrected: bool
    narrative: str

    # Errors
    error: str

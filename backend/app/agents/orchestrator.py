"""Agent 1 — Orchestrator: LangGraph state machine driving the audit pipeline.

Graph:  extract → math_audit → policy_check → correct_explain → END
Each node emits a progress event to Redis so the frontend can stream the run.
"""
from typing import Any, Callable

import structlog

from app.agents import correction, extraction, math_audit, policy_compliance
from app.agents.state import AuditState
from app.services.events import publish_progress

log = structlog.get_logger(__name__)

_STEPS: list[tuple[str, Callable[[AuditState], AuditState], int]] = [
    ("extraction", extraction.run, 30),
    ("math_audit", math_audit.run, 55),
    ("policy_check", policy_compliance.run, 80),
    ("correction", correction.run, 95),
]


def _instrumented(name: str, fn: Callable[[AuditState], AuditState], progress: int):
    def node(state: AuditState) -> AuditState:
        publish_progress(state["audit_id"], name, "running", f"Agent '{name}' started", progress - 10)
        result = fn(state)
        publish_progress(state["audit_id"], name, "completed", f"Agent '{name}' finished", progress)
        return result

    return node


def _build_graph():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(AuditState)
    for name, fn, progress in _STEPS:
        graph.add_node(name, _instrumented(name, fn, progress))
    graph.set_entry_point(_STEPS[0][0])
    for (a, _, _), (b, _, _) in zip(_STEPS, _STEPS[1:]):
        graph.add_edge(a, b)
    graph.add_edge(_STEPS[-1][0], END)
    return graph.compile()


def run_pipeline(initial: AuditState) -> AuditState:
    """Execute the full agent pipeline. Falls back to sequential execution if
    LangGraph is unavailable; the node functions are identical either way."""
    publish_progress(initial["audit_id"], "orchestrator", "running", "Pipeline started", 5)
    try:
        try:
            compiled = _build_graph()
            final: dict[str, Any] = compiled.invoke(initial)
        except ImportError:
            log.warning("langgraph_missing_fallback_sequential")
            state = initial
            for name, fn, progress in _STEPS:
                state = _instrumented(name, fn, progress)(state)
            final = dict(state)
        publish_progress(initial["audit_id"], "done", "completed", "Audit complete", 100)
        return final  # type: ignore[return-value]
    except Exception as exc:
        log.exception("pipeline_failed", audit_id=initial.get("audit_id"))
        publish_progress(initial["audit_id"], "error", "failed", str(exc), 100)
        initial["error"] = str(exc)
        return initial

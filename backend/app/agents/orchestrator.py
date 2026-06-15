"""Agent 1 — Orchestrator: Google ADK workflow driving the audit pipeline.

The pipeline is modelled as an ADK ``SequentialAgent`` (the supervisor) whose
sub-agents are deterministic workflow agents — one per stage:

    extraction → math_audit → policy_check → correction

Each sub-agent reads and writes the shared **session state** (ADK's
``session.state`` is our :class:`AuditState`) and emits an ADK **event** that
we mirror to Redis so the frontend can stream the run. This is the session /
events / state separation ADK is built around: state is the durable working
memory, events are the observable timeline.

The ADK sub-agents wrap the *same* pure functions used everywhere else
(``extraction.run`` etc.), so behaviour is identical whether the audit runs
under ADK or the no-framework sequential fallback used when ``google-adk`` is
not installed (CI, offline dev).
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

import structlog

from app.agents import correction, extraction, math_audit, policy_compliance, report
from app.agents.state import AuditState
from app.services.events import publish_progress

log = structlog.get_logger(__name__)

# (name, function, progress%) — single source of truth for both ADK and fallback.
# extraction → math_audit → policy_check → correction → report
_STEPS: list[tuple[str, Callable[[AuditState], AuditState], int]] = [
    ("extraction", extraction.run, 25),
    ("math_audit", math_audit.run, 45),
    ("policy_check", policy_compliance.run, 65),
    ("correction", correction.run, 82),
    ("report", report.run, 95),
]

_STATE_KEY = "audit"  # where the AuditState lives inside ADK session.state


def _instrumented(name: str, fn: Callable[[AuditState], AuditState], progress: int):
    """Wrap a stage function so it publishes start/finish progress to Redis."""

    def node(state: AuditState) -> AuditState:
        publish_progress(state["audit_id"], name, "running", f"Agent '{name}' started", progress - 10)
        result = fn(state)
        publish_progress(state["audit_id"], name, "completed", f"Agent '{name}' finished", progress)
        return result

    return node


# --------------------------------------------------------------------------- #
# Google ADK path
# --------------------------------------------------------------------------- #
def _build_adk_agent():
    """Build the ADK SequentialAgent. Raises ImportError if ADK is absent."""
    from collections.abc import AsyncGenerator

    from google.adk.agents import BaseAgent, SequentialAgent
    from google.adk.agents.invocation_context import InvocationContext
    from google.adk.events import Event, EventActions

    class _StageAgent(BaseAgent):
        """A deterministic ADK workflow agent wrapping one pipeline stage.

        Reads the AuditState from session state, runs the stage function, and
        writes the mutated state back via an event ``state_delta`` — the
        ADK-idiomatic way to make state changes observable and replayable.
        """

        # BaseAgent is a pydantic model; allow our plain callable as a field.
        model_config = {"arbitrary_types_allowed": True}
        fn: Callable[[AuditState], AuditState]
        progress: int

        async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
            state: AuditState = ctx.session.state.get(_STATE_KEY, {})  # type: ignore[assignment]
            # Stage functions are sync/CPU-bound (SymPy, regex) — keep the event
            # loop responsive by running them in a worker thread.
            updated = await asyncio.to_thread(
                _instrumented(self.name, self.fn, self.progress), state
            )
            yield Event(
                author=self.name,
                actions=EventActions(state_delta={_STATE_KEY: updated}),
            )

    sub_agents = [
        _StageAgent(name=name, fn=fn, progress=progress)
        for name, fn, progress in _STEPS
    ]
    return SequentialAgent(name="audit_orchestrator", sub_agents=sub_agents)


async def _run_adk_async(initial: AuditState) -> AuditState:
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    agent = _build_adk_agent()
    session_service = InMemorySessionService()
    app_name, user_id = "auditor", initial["org_id"]
    session = await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=initial["audit_id"],
        state={_STATE_KEY: initial},
    )
    runner = Runner(agent=agent, app_name=app_name, session_service=session_service)
    trigger = types.Content(role="user", parts=[types.Part(text="run audit")])
    async for _ in runner.run_async(
        user_id=user_id, session_id=session.id, new_message=trigger
    ):
        pass  # progress is streamed via Redis inside each stage; events drive state
    final = await session_service.get_session(
        app_name=app_name, user_id=user_id, session_id=session.id
    )
    return final.state.get(_STATE_KEY, initial)  # type: ignore[return-value]


def _run_adk(initial: AuditState) -> AuditState:
    """Drive the async ADK pipeline from a sync caller.

    The Celery worker has no event loop, so ``asyncio.run`` works directly.
    Under ``INLINE_AUDIT_EXECUTION`` the call happens inside FastAPI's running
    loop, where ``asyncio.run`` is illegal — there we run it in a worker thread
    with its own loop. ImportError (ADK not installed) propagates either way so
    ``run_pipeline`` can fall back to sequential execution.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_run_adk_async(initial))  # no loop running (worker)
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(_run_adk_async(initial))).result()


# --------------------------------------------------------------------------- #
# Fallback path (no framework) — identical stage functions, run in order.
# --------------------------------------------------------------------------- #
def _run_sequential(initial: AuditState) -> AuditState:
    state = initial
    for name, fn, progress in _STEPS:
        state = _instrumented(name, fn, progress)(state)
    return state


def run_pipeline(initial: AuditState) -> AuditState:
    """Execute the full agent pipeline.

    Prefers the Google ADK orchestration; if ``google-adk`` is unavailable (or
    its runtime errors), falls back to plain sequential execution of the same
    stage functions. Either way the result is one fully-populated AuditState.
    """
    publish_progress(initial["audit_id"], "orchestrator", "running", "Pipeline started", 5)
    try:
        try:
            final: dict[str, Any] = dict(_run_adk(initial))
        except ImportError:
            log.warning("google_adk_missing_fallback_sequential")
            final = dict(_run_sequential(initial))
        publish_progress(initial["audit_id"], "done", "completed", "Audit complete", 100)
        return final  # type: ignore[return-value]
    except Exception as exc:
        log.exception("pipeline_failed", audit_id=initial.get("audit_id"))
        publish_progress(initial["audit_id"], "error", "failed", str(exc), 100)
        initial["error"] = str(exc)
        return initial

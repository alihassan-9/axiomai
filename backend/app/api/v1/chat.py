"""API — Audit assistant chat (/api/v1/chat).

A grounded assistant: it answers questions using ONLY the user's own audit, invoice
and policy data (pulled live from the DB) via the local LLM. When the LLM is
unavailable it falls back to a deterministic summary so the chat still responds.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import llm
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.models import Audit, AuditStatus, Policy, Violation

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    grounded: bool  # True = answered by the LLM; False = deterministic fallback


SYSTEM = (
    "You are Axiom's invoice-audit assistant. Answer the user's question using ONLY the CONTEXT "
    "below about their invoices, audits and policies. Be concise and specific, cite exact figures, "
    "and never invent data. If the answer is not in the context, say you don't have that information yet."
)


async def _build_context(db: AsyncSession, org_id: str) -> tuple[str, dict]:
    total = (await db.execute(select(func.count(Audit.id)).where(Audit.org_id == org_id))).scalar_one()
    completed = (await db.execute(select(func.count(Audit.id)).where(
        Audit.org_id == org_id, Audit.status == AuditStatus.completed))).scalar_one()
    savings = (await db.execute(select(func.coalesce(func.sum(Audit.savings_amount), 0.0)).where(
        Audit.org_id == org_id, Audit.status == AuditStatus.completed))).scalar_one()
    violations = (await db.execute(select(func.count(Violation.id)).where(
        Violation.org_id == org_id))).scalar_one()

    recent = (await db.execute(
        select(Audit).where(Audit.org_id == org_id)
        .order_by(Audit.created_at.desc()).limit(8))).scalars().all()
    policies = (await db.execute(
        select(Policy).where(Policy.org_id == org_id, Policy.is_active.is_(True)))).scalars().all()

    stats = {"total": total, "completed": completed,
             "savings": round(float(savings), 2), "violations": violations}

    lines = [
        f"SUMMARY: {total} audits ({completed} completed), ${stats['savings']:.2f} total recovered, "
        f"{violations} policy violation(s) across the workspace.",
        "ACTIVE POLICIES: " + (", ".join(p.name for p in policies) or "none configured"),
        "RECENT AUDITS:",
    ]
    if not recent:
        lines.append("- (no audits yet)")
    for a in recent:
        inv = a.findings_json.get("invoice", {}) if isinstance(a.findings_json, dict) else {}
        vendor = inv.get("vendor") or "Invoice"
        math_n = len(a.findings_json.get("math_findings", []) or []) if isinstance(a.findings_json, dict) else 0
        pol_n = len(a.findings_json.get("policy_findings", []) or []) if isinstance(a.findings_json, dict) else 0
        lines.append(
            f"- {vendor} [{a.status.value}] recovered ${a.savings_amount:.2f}, "
            f"{math_n} math issue(s), {pol_n} policy finding(s) (audit {a.id[:8]})")
    return "\n".join(lines), stats


def _fallback(context: str, stats: dict) -> str:
    return (
        "The chat model isn't reachable right now (start Ollama to enable full Q&A). "
        f"Here's a live summary instead:\n\n{context}"
        if stats["total"] else
        "The chat model isn't reachable right now (start Ollama to enable full Q&A). "
        "You don't have any audits yet — upload an invoice to get started."
    )


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, user: CurrentUser = Depends(get_current_user),
               db: AsyncSession = Depends(get_db)):
    context, stats = await _build_context(db, user.org_id)
    convo = "\n".join(f"{m.role}: {m.content}" for m in body.history[-6:])
    prompt = (f"CONTEXT:\n{context}\n\n"
              f"{('CONVERSATION:' + chr(10) + convo + chr(10)) if convo else ''}"
              f"user: {body.message}\nassistant:")
    reply = llm.generate(prompt, system=SYSTEM)
    if reply and reply.strip():
        return ChatResponse(reply=reply.strip(), grounded=True)
    return ChatResponse(reply=_fallback(context, stats), grounded=False)

"""API 3 — Audit Engine (/api/v1/audit)."""
import asyncio
import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_analyst
from app.models import Audit, AuditStatus, Document, DocumentStatus, DocumentType
from app.schemas import AuditDetailOut, AuditListOut, AuditOut, AuditRunRequest, PageMeta
from app.services import audit_trail
from app.services.events import subscribe_progress

router = APIRouter(prefix="/audit", tags=["audit"])


def _dispatch(audit_id: str) -> None:
    if settings.inline_audit_execution:
        from app.services.audit_runner import execute_audit
        execute_audit(audit_id)
    else:
        from app.workers.tasks import run_audit_task
        run_audit_task.delay(audit_id)


async def _create_and_dispatch(doc_id: str, user: CurrentUser, db: AsyncSession,
                               request: Request) -> Audit:
    document = (await db.execute(
        select(Document).where(Document.id == doc_id, Document.org_id == user.org_id,
                               Document.type == DocumentType.invoice,
                               Document.status != DocumentStatus.deleted)
    )).scalar_one_or_none()
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice document not found")

    audit = Audit(org_id=user.org_id, doc_id=doc_id, triggered_by=user.id)
    db.add(audit)
    await db.flush()
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="audit.run",
                             entity="audit", entity_id=audit.id,
                             ip=request.client.host if request.client else "")
    await db.commit()  # audit row must be visible to the worker before dispatch
    _dispatch(audit.id)
    return audit


@router.post("/run", response_model=AuditOut, status_code=status.HTTP_202_ACCEPTED)
async def run_audit(body: AuditRunRequest, request: Request,
                    user: CurrentUser = Depends(require_analyst),
                    db: AsyncSession = Depends(get_db)):
    """Trigger the full 5-agent audit pipeline for an invoice document."""
    return await _create_and_dispatch(body.doc_id, user, db, request)


@router.get("", response_model=AuditListOut)
async def list_audits(user: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db),
                      page: int = 1, page_size: int = 20,
                      status_filter: AuditStatus | None = None):
    page, page_size = max(1, page), min(max(1, page_size), 100)
    query = select(Audit).where(Audit.org_id == user.org_id)
    if status_filter:
        query = query.where(Audit.status == status_filter)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (await db.execute(query.order_by(Audit.created_at.desc())
                             .offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return AuditListOut(items=[AuditOut.model_validate(r) for r in rows],
                        meta=PageMeta(total=total, page=page, page_size=page_size))


async def _get_owned_audit(audit_id: str, user: CurrentUser, db: AsyncSession,
                           with_violations: bool = False) -> Audit:
    query = select(Audit).where(Audit.id == audit_id, Audit.org_id == user.org_id)
    if with_violations:
        query = query.options(selectinload(Audit.violations))
    audit = (await db.execute(query)).scalar_one_or_none()
    if audit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audit not found")
    return audit


@router.get("/{audit_id}", response_model=AuditDetailOut)
async def get_audit(audit_id: str, user: CurrentUser = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    return await _get_owned_audit(audit_id, user, db, with_violations=True)


@router.get("/{audit_id}/stream")
async def stream_audit(audit_id: str, user: CurrentUser = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    """SSE stream of real-time agent progress events."""
    audit = await _get_owned_audit(audit_id, user, db)

    async def generator():
        if audit.status in (AuditStatus.completed, AuditStatus.failed):
            yield {"event": "progress", "data": json.dumps({
                "step": "done" if audit.status == AuditStatus.completed else "error",
                "status": audit.status.value, "progress": 100})}
            return
        try:
            async for event in subscribe_progress(audit_id):
                yield {"event": "progress", "data": json.dumps(event)}
        except asyncio.CancelledError:
            return

    return EventSourceResponse(generator())


@router.post("/{audit_id}/rerun", response_model=AuditOut, status_code=status.HTTP_202_ACCEPTED)
async def rerun_audit(audit_id: str, request: Request,
                      user: CurrentUser = Depends(require_analyst),
                      db: AsyncSession = Depends(get_db)):
    """Re-audit the same document with the current policy set."""
    previous = await _get_owned_audit(audit_id, user, db)
    return await _create_and_dispatch(previous.doc_id, user, db, request)


@router.get("/{audit_id}/export")
async def export_audit(audit_id: str, format: str = "csv",
                       user: CurrentUser = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    audit = await _get_owned_audit(audit_id, user, db, with_violations=True)
    if audit.status != AuditStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Audit not completed yet")
    if format == "csv":
        return _export_csv(audit)
    if format == "pdf":
        return _export_pdf(audit)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "format must be csv or pdf")


def _export_csv(audit: Audit) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["category", "severity", "explanation"])
    for v in audit.violations:
        writer.writerow([v.category, v.severity.value, v.explanation])
    writer.writerow([])
    writer.writerow(["savings_amount", audit.savings_amount])
    buffer.seek(0)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename=audit-{audit.id}.csv"})


def _export_pdf(audit: Audit) -> StreamingResponse:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 2 * cm
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(2 * cm, y, f"Audit Report — {audit.id}")
    y -= 1 * cm
    pdf.setFont("Helvetica", 10)
    for line in (audit.narrative or "No narrative").split("\n"):
        while line:
            pdf.drawString(2 * cm, y, line[:95])
            line = line[95:]
            y -= 0.5 * cm
            if y < 2 * cm:
                pdf.showPage()
                pdf.setFont("Helvetica", 10)
                y = height - 2 * cm
    y -= 0.5 * cm
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(2 * cm, y, f"Detected savings: ${audit.savings_amount:.2f}")
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=audit-{audit.id}.pdf"})

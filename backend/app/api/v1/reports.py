"""API 5 — Analytics & Reporting (/api/v1/reports)."""
import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.models import Audit, AuditStatus, Document, DocumentStatus, Violation
from app.schemas import SummaryReport, TrendPoint

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=SummaryReport)
async def summary(user: CurrentUser = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    org = user.org_id
    total = (await db.execute(select(func.count(Audit.id)).where(Audit.org_id == org))).scalar_one()
    completed = (await db.execute(select(func.count(Audit.id)).where(
        Audit.org_id == org, Audit.status == AuditStatus.completed))).scalar_one()
    failed = (await db.execute(select(func.count(Audit.id)).where(
        Audit.org_id == org, Audit.status == AuditStatus.failed))).scalar_one()
    violations = (await db.execute(select(func.count(Violation.id)).where(
        Violation.org_id == org))).scalar_one()
    savings = (await db.execute(select(func.coalesce(func.sum(Audit.savings_amount), 0.0)).where(
        Audit.org_id == org, Audit.status == AuditStatus.completed))).scalar_one()
    documents = (await db.execute(select(func.count(Document.id)).where(
        Document.org_id == org, Document.status != DocumentStatus.deleted))).scalar_one()
    clean = (await db.execute(
        select(func.count(Audit.id)).where(
            Audit.org_id == org, Audit.status == AuditStatus.completed,
            ~Audit.id.in_(select(Violation.audit_id).where(Violation.org_id == org)))
    )).scalar_one()
    score = round(100.0 * clean / completed, 1) if completed else 100.0
    return SummaryReport(total_audits=total, completed_audits=completed, failed_audits=failed,
                         total_violations=violations, compliance_score=score,
                         total_savings=round(float(savings), 2), documents_processed=documents)


@router.get("/trends", response_model=list[TrendPoint])
async def trends(days: int = 30, user: CurrentUser = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    """Daily audit/violation/savings counts for the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=min(days, 365))
    audit_rows = (await db.execute(
        select(func.date(Audit.created_at), func.count(Audit.id),
               func.coalesce(func.sum(Audit.savings_amount), 0.0))
        .where(Audit.org_id == user.org_id, Audit.created_at >= since)
        .group_by(func.date(Audit.created_at)))).all()
    violation_rows = (await db.execute(
        select(func.date(Violation.created_at), func.count(Violation.id))
        .where(Violation.org_id == user.org_id, Violation.created_at >= since)
        .group_by(func.date(Violation.created_at)))).all()
    violations_by_day = {str(d): c for d, c in violation_rows}
    return [TrendPoint(date=str(d), audits=count, savings=round(float(s), 2),
                       violations=violations_by_day.get(str(d), 0))
            for d, count, s in sorted(audit_rows)]


@router.get("/savings")
async def savings(user: CurrentUser = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Audit.id, Audit.doc_id, Audit.savings_amount, Audit.completed_at)
        .where(Audit.org_id == user.org_id, Audit.status == AuditStatus.completed,
               Audit.savings_amount > 0)
        .order_by(Audit.savings_amount.desc()).limit(100))).all()
    total = sum(r.savings_amount for r in rows)
    return {"total_savings": round(total, 2),
            "items": [{"audit_id": r.id, "doc_id": r.doc_id, "savings": round(r.savings_amount, 2),
                       "completed_at": r.completed_at.isoformat() if r.completed_at else None}
                      for r in rows]}


@router.get("/vendor/{vendor_name}")
async def vendor_report(vendor_name: str, user: CurrentUser = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """Audit history for a vendor (matched against extracted invoice JSON)."""
    audits = (await db.execute(
        select(Audit).where(Audit.org_id == user.org_id, Audit.status == AuditStatus.completed)
        .order_by(Audit.created_at.desc()).limit(500))).scalars().all()
    matched = [a for a in audits
               if vendor_name.lower() in str(a.findings_json.get("invoice", {}).get("vendor", "")).lower()]
    return {
        "vendor": vendor_name,
        "audits": len(matched),
        "total_savings": round(sum(a.savings_amount for a in matched), 2),
        "with_violations": sum(1 for a in matched
                               if a.findings_json.get("math_findings") or a.findings_json.get("policy_findings")),
        "items": [{"audit_id": a.id, "doc_id": a.doc_id, "savings": a.savings_amount,
                   "created_at": a.created_at.isoformat()} for a in matched[:50]],
    }


@router.post("/export")
async def export_report(days: int = 30, user: CurrentUser = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """CSV export of all audits in a date range."""
    since = datetime.now(timezone.utc) - timedelta(days=min(days, 365))
    audits = (await db.execute(
        select(Audit).where(Audit.org_id == user.org_id, Audit.created_at >= since)
        .order_by(Audit.created_at.desc()))).scalars().all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["audit_id", "doc_id", "status", "savings", "created_at", "completed_at"])
    for a in audits:
        writer.writerow([a.id, a.doc_id, a.status.value, a.savings_amount,
                         a.created_at.isoformat(), a.completed_at.isoformat() if a.completed_at else ""])
    buffer.seek(0)
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=audits-export.csv"})

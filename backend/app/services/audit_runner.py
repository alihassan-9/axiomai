"""Executes an audit end-to-end: load document, run agent pipeline, persist results.

Runs inside the Celery worker (sync SQLAlchemy session) — kept separate from
the async API layer on purpose.
"""
from datetime import datetime, timezone

import structlog
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.agents.orchestrator import run_pipeline
from app.agents.state import AuditState
from app.ai import pdf_text
from app.core.config import settings
from app.models import Audit, AuditStatus, Document, DocumentStatus, Extraction, Policy, Severity, Violation
from app.services.storage import storage

log = structlog.get_logger(__name__)

_engine = create_engine(settings.database_sync_url, pool_pre_ping=True)
SyncSession = sessionmaker(bind=_engine)

_SEVERITIES = {s.value for s in Severity}


def execute_audit(audit_id: str) -> None:
    with SyncSession() as db:
        audit = db.get(Audit, audit_id)
        if audit is None:
            log.error("audit_not_found", audit_id=audit_id)
            return
        document = db.get(Document, audit.doc_id)
        try:
            audit.status = AuditStatus.running
            audit.started_at = datetime.now(timezone.utc)
            db.commit()
            _run(db, audit, document)
        except Exception as exc:
            log.exception("audit_failed", audit_id=audit_id)
            audit.status = AuditStatus.failed
            audit.error = str(exc)[:2000]
            audit.completed_at = datetime.now(timezone.utc)
            db.commit()


def _run(db: Session, audit: Audit, document: Document) -> None:
    pdf_bytes = storage.download(document.s3_key)
    raw_text, _ = pdf_text.extract_text(pdf_bytes, document.content_type)

    policies = db.execute(
        select(Policy).where(Policy.org_id == audit.org_id, Policy.is_active.is_(True))
    ).scalars().all()

    state: AuditState = {
        "audit_id": audit.id,
        "org_id": audit.org_id,
        "doc_id": document.id,
        "raw_text": raw_text,
        "pdf_bytes": pdf_bytes,
        "content_type": document.content_type,
        "policies": [{"id": p.id, "name": p.name, "rule_json": p.rule_json} for p in policies],
        "retries": 0,
    }
    final = run_pipeline(state)

    if final.get("error"):
        raise RuntimeError(final["error"])

    db.add(Extraction(
        org_id=audit.org_id, doc_id=document.id, raw_json=final.get("invoice", {}),
        confidence=final.get("extraction_confidence", 0.0),
        method=final.get("extraction_method", "deterministic"),
    ))
    document.status = DocumentStatus.extracted

    for f in final.get("math_findings", []):
        db.add(Violation(
            org_id=audit.org_id, audit_id=audit.id, category="math",
            severity=Severity(f.get("severity", "high") if f.get("severity") in _SEVERITIES else "high"),
            explanation=f.get("formula", f.get("citation", "")), detail_json=f,
        ))
    for f in final.get("policy_findings", []):
        db.add(Violation(
            org_id=audit.org_id, audit_id=audit.id,
            rule_id=f.get("policy_id"), category="policy",
            severity=Severity(f.get("severity", "medium") if f.get("severity") in _SEVERITIES else "medium"),
            explanation=f.get("message", ""), detail_json=f,
        ))

    audit.findings_json = {
        "invoice": final.get("invoice", {}),
        "math_findings": final.get("math_findings", []),
        "policy_findings": final.get("policy_findings", []),
        "math_passed": final.get("math_passed", False),
        "corrected": final.get("corrected", False),
        "extraction_method": final.get("extraction_method", ""),
        "extraction_confidence": final.get("extraction_confidence", 0.0),
    }
    audit.narrative = final.get("narrative", "")
    audit.savings_amount = final.get("savings_amount", 0.0)
    audit.status = AuditStatus.completed
    audit.completed_at = datetime.now(timezone.utc)
    db.commit()


def index_policy_document(doc_id: str) -> None:
    """Extract text from a policy PDF and add it to the org's FAISS index."""
    from app.ai.vector_store import OrgVectorStore

    with SyncSession() as db:
        document = db.get(Document, doc_id)
        if document is None:
            return
        try:
            data = storage.download(document.s3_key)
            text, _ = pdf_text.extract_text(data, document.content_type)
            count = OrgVectorStore(document.org_id).add_document(doc_id, text)
            document.status = DocumentStatus.indexed
            log.info("policy_indexed", doc_id=doc_id, chunks=count)
        except Exception as exc:
            log.exception("policy_index_failed", doc_id=doc_id)
            document.status = DocumentStatus.failed
            document.error = str(exc)[:2000]
        db.commit()

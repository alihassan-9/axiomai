"""Celery tasks. Retries are bounded; failures are persisted on the audit row."""
from app.services.audit_runner import execute_audit, index_policy_document
from app.workers.celery_app import celery_app


@celery_app.task(name="audit.run", bind=True, max_retries=2, default_retry_delay=10)
def run_audit_task(self, audit_id: str) -> str:
    execute_audit(audit_id)
    return audit_id


@celery_app.task(name="policy.index", bind=True, max_retries=2, default_retry_delay=10)
def index_policy_task(self, doc_id: str) -> str:
    index_policy_document(doc_id)
    return doc_id

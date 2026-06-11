"""API 2 — Document Ingestion (/api/v1/documents)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_analyst
from app.models import Document, DocumentStatus, DocumentType, Extraction
from app.schemas import DocumentOut, ExtractionOut
from app.services import audit_trail
from app.services.storage import storage

router = APIRouter(prefix="/documents", tags=["documents"])


async def _validate_upload(file: UploadFile) -> bytes:
    if file.content_type not in settings.allowed_upload_type_list:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            f"Unsupported type {file.content_type}; allowed: {settings.allowed_upload_types}")
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"File exceeds {settings.max_upload_mb} MB limit")
    if file.content_type == "application/pdf" and not data[:5].startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File is not a valid PDF")
    return data


async def _store(db: AsyncSession, user: CurrentUser, file: UploadFile, data: bytes,
                 doc_type: DocumentType, request: Request) -> Document:
    key = f"{user.org_id}/{doc_type.value}/{uuid.uuid4().hex}/{file.filename}"
    storage.upload(key, data, file.content_type or "application/octet-stream")
    document = Document(org_id=user.org_id, uploaded_by=user.id, type=doc_type,
                        filename=file.filename or "upload", content_type=file.content_type or "",
                        size_bytes=len(data), s3_key=key)
    db.add(document)
    await db.flush()
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="document.upload",
                             entity="document", entity_id=document.id,
                             ip=request.client.host if request.client else "",
                             detail={"filename": document.filename, "type": doc_type.value})
    return document


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_invoice(request: Request, file: UploadFile,
                         user: CurrentUser = Depends(require_analyst),
                         db: AsyncSession = Depends(get_db)):
    data = await _validate_upload(file)
    return await _store(db, user, file, data, DocumentType.invoice, request)


@router.post("/policy/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_policy(request: Request, file: UploadFile,
                        user: CurrentUser = Depends(require_analyst),
                        db: AsyncSession = Depends(get_db)):
    """Upload a policy PDF; it is chunked + embedded into the org's RAG index."""
    data = await _validate_upload(file)
    document = await _store(db, user, file, data, DocumentType.policy, request)
    document.status = DocumentStatus.processing
    await db.flush()
    _dispatch_indexing(document.id)
    return document


def _dispatch_indexing(doc_id: str) -> None:
    if settings.inline_audit_execution:
        from app.services.audit_runner import index_policy_document
        index_policy_document(doc_id)
    else:
        from app.workers.tasks import index_policy_task
        index_policy_task.delay(doc_id)


@router.get("", response_model=list[DocumentOut])
async def list_documents(user: CurrentUser = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db),
                         type: DocumentType | None = None):
    query = select(Document).where(Document.org_id == user.org_id,
                                   Document.status != DocumentStatus.deleted)
    if type:
        query = query.where(Document.type == type)
    rows = (await db.execute(query.order_by(Document.created_at.desc()))).scalars().all()
    return rows


async def _get_owned_document(doc_id: str, user: CurrentUser, db: AsyncSession) -> Document:
    document = (await db.execute(
        select(Document).where(Document.id == doc_id, Document.org_id == user.org_id)
    )).scalar_one_or_none()
    if document is None or document.status == DocumentStatus.deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: str, user: CurrentUser = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    return await _get_owned_document(doc_id, user, db)


@router.get("/{doc_id}/preview")
async def preview_document(doc_id: str, user: CurrentUser = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    """Short-lived presigned URL for in-browser PDF rendering."""
    document = await _get_owned_document(doc_id, user, db)
    return {"url": storage.presigned_url(document.s3_key, minutes=15)}


@router.get("/{doc_id}/extracted", response_model=ExtractionOut)
async def get_extraction(doc_id: str, user: CurrentUser = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    await _get_owned_document(doc_id, user, db)
    extraction = (await db.execute(
        select(Extraction).where(Extraction.doc_id == doc_id, Extraction.org_id == user.org_id)
        .order_by(Extraction.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    if extraction is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No extraction yet — run an audit first")
    return extraction


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, request: Request,
                          user: CurrentUser = Depends(require_analyst),
                          db: AsyncSession = Depends(get_db)):
    """Soft delete; policy docs are also removed from the vector index."""
    document = await _get_owned_document(doc_id, user, db)
    document.status = DocumentStatus.deleted
    if document.type == DocumentType.policy:
        from app.ai.vector_store import OrgVectorStore
        OrgVectorStore(user.org_id).remove_document(doc_id)
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="document.delete",
                             entity="document", entity_id=doc_id,
                             ip=request.client.host if request.client else "")

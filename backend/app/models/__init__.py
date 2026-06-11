"""SQLAlchemy ORM models — 8 core multi-tenant tables.

Every tenant-owned table carries an indexed `org_id` foreign key; all queries
must scope on it (enforced in the service layer via CurrentUser deps).
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text,
                        func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class UserRole(str, enum.Enum):
    admin = "admin"
    analyst = "analyst"
    viewer = "viewer"


class DocumentType(str, enum.Enum):
    invoice = "invoice"
    policy = "policy"


class DocumentStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    extracted = "extracted"
    indexed = "indexed"
    failed = "failed"
    deleted = "deleted"


class AuditStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class Severity(str, enum.Enum):
    info = "info"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Organisation(Base):
    __tablename__ = "organisations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(50), default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="organisation")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.analyst)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organisation: Mapped[Organisation] = relationship(back_populates="users")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.uploaded)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    doc_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True, nullable=False)
    raw_json: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    method: Mapped[str] = mapped_column(String(50), default="deterministic")  # deterministic | llm | hybrid
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Audit(Base):
    __tablename__ = "audits"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    doc_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True, nullable=False)
    triggered_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[AuditStatus] = mapped_column(Enum(AuditStatus), default=AuditStatus.pending)
    findings_json: Mapped[dict] = mapped_column(JSON, default=dict)
    narrative: Mapped[str] = mapped_column(Text, default="")
    savings_amount: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    violations: Mapped[list["Violation"]] = relationship(back_populates="audit")


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    audit_id: Mapped[str] = mapped_column(ForeignKey("audits.id"), index=True, nullable=False)
    rule_id: Mapped[str | None] = mapped_column(ForeignKey("policies.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="math")  # math | policy | duplicate | structure
    severity: Mapped[Severity] = mapped_column(Enum(Severity), default=Severity.medium)
    explanation: Mapped[str] = mapped_column(Text, default="")
    detail_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    audit: Mapped[Audit] = relationship(back_populates="violations")


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("organisations.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    rule_json: Mapped[dict] = mapped_column(JSON, default=dict)
    source_doc_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    org_id: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), default="")
    entity_id: Mapped[str] = mapped_column(String(64), default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

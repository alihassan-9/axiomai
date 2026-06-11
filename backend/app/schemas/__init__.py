"""Pydantic request/response schemas for all API modules."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------- auth


class RegisterRequest(BaseModel):
    organisation_name: str = Field(min_length=2, max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    org_id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


# ---------------------------------------------------------------- documents


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    type: str
    filename: str
    content_type: str
    size_bytes: int
    status: str
    error: str | None = None
    created_at: datetime


class ExtractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    doc_id: str
    raw_json: dict[str, Any]
    confidence: float
    method: str
    created_at: datetime


# ---------------------------------------------------------------- audit


class AuditRunRequest(BaseModel):
    doc_id: str


class ViolationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rule_id: str | None
    category: str
    severity: str
    explanation: str
    detail_json: dict[str, Any]


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    doc_id: str
    status: str
    findings_json: dict[str, Any]
    narrative: str
    savings_amount: float
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class AuditDetailOut(AuditOut):
    violations: list[ViolationOut] = []


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int


class AuditListOut(BaseModel):
    items: list[AuditOut]
    meta: PageMeta


# ---------------------------------------------------------------- compliance


class PolicyRule(BaseModel):
    """Structured compliance rule evaluated deterministically by the Policy agent.

    field: extraction field path, e.g. "grand_total", "line_items[].category"
    operator: comparison applied against `value`
    """
    field: str
    operator: Literal["lt", "lte", "gt", "gte", "eq", "neq", "in", "not_in", "contains"]
    value: Any
    when: dict[str, Any] | None = None  # optional condition, e.g. {"category": "Software"}
    severity: Literal["info", "low", "medium", "high", "critical"] = "medium"
    message: str = ""


class PolicyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ""
    rules: list[PolicyRule] = []
    is_active: bool = True


class PolicyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    rules: list[PolicyRule] | None = None
    is_active: bool | None = None


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    rule_json: dict[str, Any]
    source_doc_id: str | None
    is_active: bool
    created_at: datetime


class ComplianceCheckRequest(BaseModel):
    invoice: dict[str, Any]  # structured invoice JSON (same schema the Extraction agent emits)


class ComplianceCheckResult(BaseModel):
    passed: bool
    violations: list[dict[str, Any]]


# ---------------------------------------------------------------- reports


class SummaryReport(BaseModel):
    total_audits: int
    completed_audits: int
    failed_audits: int
    total_violations: int
    compliance_score: float  # 0-100
    total_savings: float
    documents_processed: int


class TrendPoint(BaseModel):
    date: str
    audits: int
    violations: int
    savings: float


# ---------------------------------------------------------------- admin


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str = ""
    role: Literal["admin", "analyst", "viewer"] = "analyst"


class InviteOut(BaseModel):
    email: EmailStr
    temporary_password: str
    role: str


class RoleUpdateRequest(BaseModel):
    role: Literal["admin", "analyst", "viewer"]


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str | None
    action: str
    entity: str
    entity_id: str
    ip_address: str
    detail: dict[str, Any]
    timestamp: datetime


class UsageOut(BaseModel):
    documents_uploaded: int
    audits_run: int
    storage_bytes: int
    plan_tier: str

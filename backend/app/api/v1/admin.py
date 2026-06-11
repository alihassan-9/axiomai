"""API 6 — Admin & Organisation (/api/v1/admin). All endpoints admin-only."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_admin
from app.core.security import hash_password
from app.models import (Audit, AuditLog, Document, DocumentStatus, Organisation, User, UserRole)
from app.schemas import AuditLogOut, InviteOut, InviteRequest, RoleUpdateRequest, UsageOut, UserOut
from app.services import audit_trail

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(user: CurrentUser = Depends(require_admin),
                     db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).where(User.org_id == user.org_id)
                             .order_by(User.created_at))).scalars().all()
    return rows


@router.post("/users/invite", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
async def invite_user(body: InviteRequest, request: Request,
                      user: CurrentUser = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    """Create a team member with a temporary password (returned once; the user
    must change it on first login). Email delivery is handled out-of-band."""
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    temp_password = secrets.token_urlsafe(12)
    invited = User(org_id=user.org_id, email=body.email, full_name=body.full_name,
                   role=UserRole(body.role), password_hash=hash_password(temp_password))
    db.add(invited)
    await db.flush()
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="admin.invite",
                             entity="user", entity_id=invited.id,
                             ip=request.client.host if request.client else "",
                             detail={"email": body.email, "role": body.role})
    return InviteOut(email=body.email, temporary_password=temp_password, role=body.role)


@router.put("/users/{user_id}/role", response_model=UserOut)
async def update_role(user_id: str, body: RoleUpdateRequest, request: Request,
                      user: CurrentUser = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    target = (await db.execute(select(User).where(User.id == user_id,
                                                  User.org_id == user.org_id))).scalar_one_or_none()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == user.id and body.role != UserRole.admin.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot demote yourself")
    target.role = UserRole(body.role)
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="admin.role_change",
                             entity="user", entity_id=user_id,
                             ip=request.client.host if request.client else "",
                             detail={"new_role": body.role})
    return target


@router.get("/usage", response_model=UsageOut)
async def usage(user: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    documents = (await db.execute(select(func.count(Document.id)).where(
        Document.org_id == user.org_id, Document.status != DocumentStatus.deleted))).scalar_one()
    audits = (await db.execute(select(func.count(Audit.id)).where(
        Audit.org_id == user.org_id))).scalar_one()
    storage_bytes = (await db.execute(select(func.coalesce(func.sum(Document.size_bytes), 0)).where(
        Document.org_id == user.org_id, Document.status != DocumentStatus.deleted))).scalar_one()
    org = (await db.execute(select(Organisation).where(
        Organisation.id == user.org_id))).scalar_one()
    return UsageOut(documents_uploaded=documents, audits_run=audits,
                    storage_bytes=int(storage_bytes), plan_tier=org.plan_tier)


@router.get("/audit-log", response_model=list[AuditLogOut])
async def system_audit_log(user: CurrentUser = Depends(require_admin),
                           db: AsyncSession = Depends(get_db), limit: int = 200):
    rows = (await db.execute(select(AuditLog).where(AuditLog.org_id == user.org_id)
                             .order_by(AuditLog.timestamp.desc())
                             .limit(min(limit, 1000)))).scalars().all()
    return rows

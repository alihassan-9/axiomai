"""API 1 — Authentication & Authorization (/api/v1/auth)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, bearer_scheme, get_current_user
from app.core.security import (create_access_token, create_refresh_token, decode_token,
                               hash_password, is_token_revoked, revoke_token, verify_password)
from app.models import Organisation, User, UserRole
from app.schemas import (LoginRequest, RefreshRequest, RegisterRequest, TokenPair, UserOut,
                         UserUpdate)
from app.services import audit_trail

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Create a new organisation with its first (admin) user."""
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    org = Organisation(name=body.organisation_name)
    db.add(org)
    await db.flush()
    user = User(org_id=org.id, email=body.email, full_name=body.full_name,
                role=UserRole.admin, password_hash=hash_password(body.password))
    db.add(user)
    await db.flush()
    await audit_trail.record(db, org_id=org.id, user_id=user.id, action="auth.register",
                             entity="organisation", entity_id=org.id,
                             ip=request.client.host if request.client else "")
    return TokenPair(access_token=create_access_token(user.id, org.id, user.role.value),
                     refresh_token=create_refresh_token(user.id))


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="auth.login",
                             ip=request.client.host if request.client else "")
    return TokenPair(access_token=create_access_token(user.id, user.org_id, user.role.value),
                     refresh_token=create_refresh_token(user.id))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Rotate the refresh token: old one is revoked, new pair issued."""
    try:
        payload = decode_token(body.refresh_token, "refresh")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if await is_token_revoked(payload):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token revoked")
    user = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    await revoke_token(payload)
    return TokenPair(access_token=create_access_token(user.id, user.org_id, user.role.value),
                     refresh_token=create_refresh_token(user.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
                 user: CurrentUser = Depends(get_current_user)):
    """Revoke the presented access token."""
    payload = decode_token(credentials.credentials, "access")
    await revoke_token(payload)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    record = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
    return record


@router.put("/me", response_model=UserOut)
async def update_me(body: UserUpdate, user: CurrentUser = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    record = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
    if body.full_name is not None:
        record.full_name = body.full_name
    if body.password is not None:
        record.password_hash = hash_password(body.password)
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="auth.update_profile")
    return record

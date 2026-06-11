"""FastAPI dependencies: authentication, RBAC, and tenant scoping."""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token, is_token_revoked
from app.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    org_id: str
    role: UserRole
    email: str


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(credentials.credentials, "access")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if await is_token_revoked(payload):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token revoked")

    user = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    request.state.user_id = user.id
    request.state.org_id = user.org_id
    return CurrentUser(id=user.id, org_id=user.org_id, role=user.role, email=user.email)


def require_roles(*roles: UserRole):
    """Dependency factory enforcing RBAC. Admin always passes."""

    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role == UserRole.admin or user.role in roles:
            return user
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")

    return checker


require_admin = require_roles()  # admin only
require_analyst = require_roles(UserRole.analyst)  # analyst or admin
require_any = require_roles(UserRole.analyst, UserRole.viewer)  # any authenticated role

"""Immutable system audit trail — every data mutation is recorded."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def record(db: AsyncSession, *, org_id: str | None, user_id: str | None, action: str,
                 entity: str = "", entity_id: str = "", ip: str = "",
                 detail: dict[str, Any] | None = None) -> None:
    db.add(AuditLog(org_id=org_id, user_id=user_id, action=action, entity=entity,
                    entity_id=entity_id, ip_address=ip, detail=detail or {}))
    await db.flush()

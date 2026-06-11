"""API 4 — Compliance & Policy (/api/v1/compliance)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.policy_compliance import _evaluate_rule
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_analyst
from app.models import Policy, Violation
from app.schemas import (ComplianceCheckRequest, ComplianceCheckResult, PolicyCreate, PolicyOut,
                         PolicyUpdate, ViolationOut)
from app.services import audit_trail

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/policies", response_model=list[PolicyOut])
async def list_policies(user: CurrentUser = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Policy).where(Policy.org_id == user.org_id)
                             .order_by(Policy.created_at.desc()))).scalars().all()
    return rows


@router.post("/policies", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(body: PolicyCreate, request: Request,
                        user: CurrentUser = Depends(require_analyst),
                        db: AsyncSession = Depends(get_db)):
    policy = Policy(org_id=user.org_id, name=body.name, description=body.description,
                    rule_json={"rules": [r.model_dump() for r in body.rules]},
                    is_active=body.is_active)
    db.add(policy)
    await db.flush()
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="policy.create",
                             entity="policy", entity_id=policy.id,
                             ip=request.client.host if request.client else "")
    return policy


async def _get_owned_policy(policy_id: str, user: CurrentUser, db: AsyncSession) -> Policy:
    policy = (await db.execute(
        select(Policy).where(Policy.id == policy_id, Policy.org_id == user.org_id)
    )).scalar_one_or_none()
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")
    return policy


@router.put("/policies/{policy_id}", response_model=PolicyOut)
async def update_policy(policy_id: str, body: PolicyUpdate, request: Request,
                        user: CurrentUser = Depends(require_analyst),
                        db: AsyncSession = Depends(get_db)):
    policy = await _get_owned_policy(policy_id, user, db)
    if body.name is not None:
        policy.name = body.name
    if body.description is not None:
        policy.description = body.description
    if body.rules is not None:
        policy.rule_json = {"rules": [r.model_dump() for r in body.rules]}
    if body.is_active is not None:
        policy.is_active = body.is_active
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="policy.update",
                             entity="policy", entity_id=policy.id,
                             ip=request.client.host if request.client else "")
    return policy


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(policy_id: str, request: Request,
                        user: CurrentUser = Depends(require_analyst),
                        db: AsyncSession = Depends(get_db)):
    policy = await _get_owned_policy(policy_id, user, db)
    await db.delete(policy)
    await audit_trail.record(db, org_id=user.org_id, user_id=user.id, action="policy.delete",
                             entity="policy", entity_id=policy_id,
                             ip=request.client.host if request.client else "")


@router.post("/check", response_model=ComplianceCheckResult)
async def standalone_check(body: ComplianceCheckRequest,
                           user: CurrentUser = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    """Evaluate a structured invoice against active policies without a full audit."""
    policies = (await db.execute(
        select(Policy).where(Policy.org_id == user.org_id, Policy.is_active.is_(True))
    )).scalars().all()
    violations = []
    for policy in policies:
        for rule in policy.rule_json.get("rules", []):
            for violation in _evaluate_rule(rule, body.invoice):
                violation["policy_id"] = policy.id
                violation["policy_name"] = policy.name
                violations.append(violation)
    return ComplianceCheckResult(passed=not violations, violations=violations)


@router.get("/violations", response_model=list[ViolationOut])
async def list_violations(user: CurrentUser = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db),
                          limit: int = 100):
    rows = (await db.execute(
        select(Violation).where(Violation.org_id == user.org_id)
        .order_by(Violation.created_at.desc()).limit(min(limit, 500))
    )).scalars().all()
    return rows

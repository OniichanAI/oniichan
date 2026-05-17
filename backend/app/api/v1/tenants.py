from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import require_tenant_membership
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_tenant_role import UserTenantRole
from app.schemas.tenant import TenantCreateRequest, TenantResponse


router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=List[TenantResponse])
def get_tenants(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[Tenant]:
    tenants = db.scalars(
        select(Tenant)
        .join(UserTenantRole)
        .where(UserTenantRole.user_id == user.id)
    ).all()
    return list(tenants)


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreateRequest, db: Session = Depends(get_db)) -> Tenant:
    existing = db.scalar(select(Tenant).where(Tenant.slug == payload.slug))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tenant slug already exists")

    tenant = Tenant(name=payload.name, slug=payload.slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/me", response_model=TenantResponse)
def get_current_tenant(
    tenant_id: UUID = Depends(require_tenant_membership),
    db: Session = Depends(get_db),
) -> Tenant:
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id, Tenant.is_active.is_(True)))
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant

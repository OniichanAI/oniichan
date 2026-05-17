from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.tenant import get_tenant
from app.db.session import get_db
from app.models.user import User
from app.models.user_tenant_role import UserTenantRole


def require_tenant() -> UUID:
    tenant_id = get_tenant()
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing tenant context header",
        )
    return tenant_id


def require_tenant_membership(
    tenant_id: UUID = Depends(require_tenant),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UUID:
    """Tenant header is present AND the caller is a member of that tenant.

    Closes the IDOR where any logged-in user could spoof X-Tenant-ID and read
    another tenant's data.
    """
    membership = db.scalar(
        select(UserTenantRole.id).where(
            UserTenantRole.tenant_id == tenant_id,
            UserTenantRole.user_id == user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to this tenant",
        )
    return tenant_id

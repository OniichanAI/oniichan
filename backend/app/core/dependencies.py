from fastapi import HTTPException, status
from uuid import UUID

from app.core.tenant import get_tenant


def require_tenant() -> UUID:
    tenant_id = get_tenant()
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing tenant context header",
        )
    return tenant_id

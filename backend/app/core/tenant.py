from contextvars import ContextVar
from uuid import UUID


tenant_context: ContextVar[UUID | None] = ContextVar("tenant_context", default=None)


def set_tenant(tenant_id: UUID | None) -> None:
    tenant_context.set(tenant_id)


def get_tenant() -> UUID | None:
    return tenant_context.get()

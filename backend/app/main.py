from fastapi import FastAPI
from fastapi import Request

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.tenant import set_tenant
from uuid import UUID


def create_app() -> FastAPI:
    if settings.session_signing_secret in ("", "change_me", "replace_with_strong_secret"):
        raise RuntimeError(
            "SESSION_SIGNING_SECRET is unset or still the placeholder. "
            "Generate one with `python -c 'import secrets; print(secrets.token_urlsafe(48))'`."
        )

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.middleware("http")
    async def tenant_context_middleware(request: Request, call_next):
        raw_tenant = request.headers.get(settings.default_tenant_header)
        tenant_id = None
        if raw_tenant:
            try:
                tenant_id = UUID(raw_tenant)
            except ValueError:
                tenant_id = None
        set_tenant(tenant_id)
        response = await call_next(request)
        return response

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

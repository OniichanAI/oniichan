import logging
import time
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.tenant import set_tenant


logger = logging.getLogger("app.request")


def _allowed_origins() -> list[str]:
    return [origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()]


def create_app() -> FastAPI:
    if settings.session_signing_secret in ("", "change_me", "replace_with_strong_secret"):
        raise RuntimeError(
            "SESSION_SIGNING_SECRET is unset or still the placeholder. "
            "Generate one with `python -c 'import secrets; print(secrets.token_urlsafe(48))'`."
        )

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        correlation_id = request.headers.get("x-request-id") or uuid4().hex
        request.state.correlation_id = correlation_id

        raw_tenant = request.headers.get(settings.default_tenant_header)
        tenant_id: UUID | None = None
        if raw_tenant:
            try:
                tenant_id = UUID(raw_tenant)
            except ValueError:
                tenant_id = None
        set_tenant(tenant_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "request_failed method=%s path=%s duration_ms=%.1f rid=%s",
                request.method,
                request.url.path,
                duration_ms,
                correlation_id,
            )
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = correlation_id
        logger.info(
            "method=%s path=%s status=%d duration_ms=%.1f rid=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            correlation_id,
        )
        return response

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

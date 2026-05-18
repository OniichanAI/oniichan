from fastapi import APIRouter

from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.health import router as health_router
from app.api.v1.moderation import router as moderation_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(audit_router)
api_router.include_router(moderation_router)
api_router.include_router(chat_router)
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
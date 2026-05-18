from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_tenant_membership
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.user import User
from app.schemas.analytics import (
    CompleteAnalyticsResponse,
    DailyActivityMetric,
    HourlyPeakMetric,
    ModerationLeaderboardMetric,
    TopChannelMetric,
    StabilityScoreMetric,
    AutomationRoiMetric,
    RiskDistributionMetric,
)

router = APIRouter()

@router.get("/dashboard-summary", response_model=CompleteAnalyticsResponse, status_code=status.HTTP_200_OK)
async def get_complete_dashboard_analytics(
    timeframe_days: int = 7,
    tenant_id: UUID = Depends(require_tenant_membership),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CompleteAnalyticsResponse:
    """
    Compiles and processes multi-dimensional telemetry reports from the audit trail ledger.
    
    Extracts time-series trendlines, staff efficiency tables, localized hotspots, and 
    runs programmatic weighting algorithms to output high-level server stability scores.
    All computations are strictly isolated inside the validated tenant visibility space.
    """
    if timeframe_days not in [7, 30, 90]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timeframe window configuration must be exactly 7, 30, or 90 days."
        )

    # Establish the rolling historical time index anchor
    start_date = datetime.now(timezone.utc) - timedelta(days=timeframe_days)
    base_filter = [AuditEvent.tenant_id == tenant_id, AuditEvent.created_at >= start_date]

    # 1. RISK PROFILE SEVERITY DISTRIBUTION (Donut Graph Model)
    risk_counts = (
        db.query(AuditEvent.risk_tier, func.count(AuditEvent.id).label("count"))
        .filter(*base_filter)
        .group_by(AuditEvent.risk_tier)
        .all()
    )
    risk_map = {row.risk_tier: row.count for row in risk_counts}
    low_incidents = risk_map.get("low", 0)
    medium_incidents = risk_map.get("medium", 0)
    high_incidents = risk_map.get("high", 0)
    
    risk_distribution = RiskDistributionMetric(
        low_risk_count=low_incidents,
        medium_risk_count=medium_incidents,
        high_risk_count=high_incidents
    )

    # 2. ALGORITHMIC SERVER STABILITY INDEX EVALUATION
    total_logged_incidents = low_incidents + medium_incidents + high_incidents
    if total_logged_incidents == 0:
        score_evaluation = 100
        stability_status = "Pristine & Calm"
    else:
        # Penalization factor weights: High actions remove 15, Medium remove 5, Low remove 1
        calculated_penalty = (high_incidents * 15) + (medium_incidents * 5) + (low_incidents * 1)
        score_evaluation = max(100 - calculated_penalty, 10) # Enforce a lower boundary limit floor of 10%
        
        if score_evaluation > 85:
            stability_status = "Stable & Protected"
        elif score_evaluation > 50:
            stability_status = "Volatile / Active Moderation"
        else:
            stability_status = "Critical Disruption / Raid Warning"
            
    stability_score = StabilityScoreMetric(score=int(score_evaluation), status=stability_status)

    # 3. AUTONOMOUS AUTOMATION EXTRACTION (ROI Calculation Engine)
    # Operations missing an explicit human actor_user_id link represent background worker or AI actions
    automated_actions = (
        db.query(func.count(AuditEvent.id))
        .filter(*base_filter)
        .filter(AuditEvent.actor_user_id.is_(None))
        .scalar() or 0
    )
    # Allocation baseline assumption: 30 seconds manual processing saved per task -> 0.0083 hours
    computed_hours_saved = round(automated_actions * 0.0083, 2)
    automation_roi = AutomationRoiMetric(
        actions_handled_by_bot=automated_actions,
        estimated_hours_saved=computed_hours_saved
    )

    # 4. HISTORICAL VOLUMETRIC TIMELINE (Time-Series Generation)
    daily_stats = (
        db.query(
            func.date(AuditEvent.created_at).label("date"),
            func.count(func.nullif(AuditEvent.event_type != "chat.direct_message.sent", True)).label("sent"),
            func.count(func.nullif(AuditEvent.event_type != "chat.direct_message.deleted", True)).label("deleted"),
            func.count(func.nullif(AuditEvent.event_type != "chat.channel.locked", True)).label("locked")
        )
        .filter(*base_filter)
        .group_by(func.date(AuditEvent.created_at))
        .order_by(func.date(AuditEvent.created_at).asc())
        .all()
    )
    daily_timeline = [
        DailyActivityMetric(date=str(row.date), messages_sent=row.sent, messages_deleted=row.deleted, channels_locked=row.locked)
        for row in daily_stats
    ]

    # 5. DIURNAL RADAR CHARTING (24-Hour Peak Matrix Profiling)
    hourly_stats = (
        db.query(
            func.extract("hour", AuditEvent.created_at).label("hour"),
            func.count(AuditEvent.id).label("count")
        )
        .filter(*base_filter)
        .group_by(func.extract("hour", AuditEvent.created_at))
        .order_by(func.extract("hour", AuditEvent.created_at).asc())
        .all()
    )
    hourly_peaks = [HourlyPeakMetric(hour=int(row.hour), action_count=row.count) for row in hourly_stats]

    # 6. OPERATIONAL USER PERFORMANCE LEADERBOARD (Human Staff Ranking)
    leaderboard_stats = (
        db.query(
            AuditEvent.actor_user_id.label("user_id"),
            User.username.label("username"),
            func.count(AuditEvent.id).label("total_actions")
        )
        .join(User, AuditEvent.actor_user_id == User.id)
        .filter(*base_filter)
        .group_by(AuditEvent.actor_user_id, User.username)
        .order_by(func.count(AuditEvent.id).desc())
        .limit(10)
        .all()
    )
    leaderboard = [
        ModerationLeaderboardMetric(user_id=row.user_id, username=row.username, total_actions=row.total_actions)
        for row in leaderboard_stats
    ]

    # 7. TOTAL DISCORD CHAT PURGE CALCULATOR (Impact Analysis Mapping)
    # Calculate single targeting message teardowns
    isolated_deletes_count = db.query(func.count(AuditEvent.id)).filter(*base_filter, AuditEvent.event_type == "chat.direct_message.deleted").scalar() or 0
    # Query length parameters from JSONB array elements in mass purge logs
    mass_purges_element_sum = db.query(
        func.sum(func.jsonb_array_length(AuditEvent.details["message_ids"]))
    ).filter(*base_filter, AuditEvent.event_type == "chat.direct_message.bulk_deleted").scalar() or 0
    
    total_messages_wiped = isolated_deletes_count + int(mass_purges_element_sum)

    # 8. SPATIAL INTERACTION CONCENTRATION (Top Active Channel Mapping Hotspots)
    top_channels_stats = (
        db.query(
            AuditEvent.details["channel_id"].astext.label("channel_id"),
            func.count(AuditEvent.id).label("action_count")
        )
        .filter(*base_filter)
        .filter(AuditEvent.details["channel_id"].astext.isnot(None))
        .group_by(AuditEvent.details["channel_id"].astext)
        .order_by(func.count(AuditEvent.id).desc())
        .limit(5)
        .all()
    )
    top_channels = [TopChannelMetric(channel_id=row.channel_id, action_count=row.action_count) for row in top_channels_stats]

    # Return the aggregated enterprise dataset configuration response
    return CompleteAnalyticsResponse(
        tenant_id=tenant_id,
        timeframe_days=timeframe_days,
        total_messages_wiped=total_messages_wiped,
        stability_score=stability_score,
        automation_roi=automation_roi,
        risk_distribution=risk_distribution,
        daily_timeline=daily_timeline,
        hourly_peaks=hourly_peaks,
        leaderboard=leaderboard,
        top_channels=top_channels
    )

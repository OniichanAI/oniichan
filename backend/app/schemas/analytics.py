from pydantic import BaseModel, Field
from uuid import UUID

class DailyActivityMetric(BaseModel):
    """
    Represents time-series volume stats aggregated per individual day.
    """
    date: str = Field(..., description="The calendar date format YYYY-MM-DD")
    messages_sent: int = Field(..., description="Total direct text messages dispatched via dashboard")
    messages_deleted: int = Field(..., description="Total individual message deletion events handled")
    channels_locked: int = Field(..., description="Total channel lockdown operations enforced")


class HourlyPeakMetric(BaseModel):
    """
    Represents volumetric distribution mapped across a 24-hour cycle.
    """
    hour: int = Field(..., description="The explicit hour quadrant of the day (0-23)")
    action_count: int = Field(..., description="Total accumulated moderation operations inside this hour slot")


class ModerationLeaderboardMetric(BaseModel):
    """
    Represents performance and activity metrics for an individual staff moderator.
    """
    user_id: UUID = Field(..., description="The internal unique database user identifier")
    username: str = Field(..., description="The display username of the staff member")
    total_actions: int = Field(..., description="Cumulative actions executed by this administrator")


class TopChannelMetric(BaseModel):
    """
    Represents activity concentration within a specific Discord channel.
    """
    channel_id: str = Field(..., description="The target Discord Snowflake channel ID")
    action_count: int = Field(..., description="Total recorded system interactions inside this channel")


class StabilityScoreMetric(BaseModel):
    """
    Represents the calculated health and peace quotient of the managed server.
    """
    score: int = Field(..., ge=0, le=100, description="Overall evaluated server peace index from 0 to 100")
    status: str = Field(..., description="Categorized status indicator: e.g., Stable, Volatile, Critical")


class AutomationRoiMetric(BaseModel):
    """
    Represents the business value and time saved driven by automated background systems.
    """
    actions_handled_by_bot: int = Field(..., description="Total moderation steps processed autonomously by the system")
    estimated_hours_saved: float = Field(..., description="Approximated work hours preserved for human personnel")


class RiskDistributionMetric(BaseModel):
    """
    Represents the structural breakdown of incidents categorized by severity tiers.
    """
    low_risk_count: int = Field(..., description="Volumetric count of minor enforcement alerts")
    medium_risk_count: int = Field(..., description="Volumetric count of moderate restriction occurrences")
    high_risk_count: int = Field(..., description="Volumetric count of critical emergency interventions")


class CompleteAnalyticsResponse(BaseModel):
    """
    The comprehensive unified business intelligence payload for the client admin interface.
    """
    tenant_id: UUID = Field(..., description="The operational organizational boundary context identifier")
    timeframe_days: int = Field(..., description="The designated historical analytics window scale")
    total_messages_wiped: int = Field(..., description="The aggregate summation of individual and bulk message deletions")
    stability_score: StabilityScoreMetric = Field(..., description="The overall health matrix evaluation wrapper")
    automation_roi: AutomationRoiMetric = Field(..., description="The automated efficiency output breakdown wrapper")
    risk_distribution: RiskDistributionMetric = Field(..., description="Incidents sorted by critical weight layers")
    daily_timeline: list[DailyActivityMetric] = Field(..., description="Historical activity flow list for trendline components")
    hourly_peaks: list[HourlyPeakMetric] = Field(..., description="24-hour heat distribution data arrays")
    leaderboard: list[ModerationLeaderboardMetric] = Field(..., description="Active human staff ranking breakdown metrics")
    top_channels: list[TopChannelMetric] = Field(..., description="Hotspot channel metrics sorted descending by engagement")
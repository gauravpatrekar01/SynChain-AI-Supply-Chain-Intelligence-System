"""Strict, bounded public contracts for AI reports and deterministic insights."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ReportFocus = Literal["overview", "inventory", "suppliers", "shipments"]


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    focus: ReportFocus = "overview"


class ReportFinding(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(min_length=1, max_length=1000)
    severity: Literal["info", "low", "medium", "high", "critical"]
    metric_keys: list[str] = Field(min_length=1, max_length=8)


class ReportAction(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    action: str = Field(min_length=1, max_length=300)
    reason: str = Field(min_length=1, max_length=700)
    priority: Literal["low", "medium", "high"]
    metric_keys: list[str] = Field(min_length=1, max_length=8)


class ReportNarrative(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    summary: str = Field(min_length=1, max_length=1800)
    findings: list[ReportFinding] = Field(min_length=1, max_length=8)
    recommended_actions: list[ReportAction] = Field(min_length=1, max_length=8)


class AIReport(ReportNarrative):
    focus: ReportFocus
    source_metrics: dict[str, int | float | None]
    generated_at: datetime
    snapshot_at: datetime
    provider: Literal["gemini", "local"]
    model: str | None = None
    fallback: bool
    limitations: list[str]

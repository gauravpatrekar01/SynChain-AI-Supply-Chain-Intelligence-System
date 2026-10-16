"""Authenticated copilot with bounded input and server-derived facts."""
import json
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.services.ai_context import build_ai_context
from app.services.copilot.ai_service import AICopilotService

router = APIRouter(prefix="/copilot", tags=["copilot"])
copilot_service = AICopilotService()


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class CopilotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)

    @field_validator("context")
    @classmethod
    def bound_context(cls, value):
        if len(json.dumps(value, allow_nan=False)) > 4096:
            raise ValueError("Context must be at most 4096 characters")
        return value

    @model_validator(mode="after")
    def bound_history(self):
        if sum(len(turn.content) for turn in self.history) > 24000:
            raise ValueError("Conversation history must be at most 24000 characters")
        return self


def get_copilot_context(_user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    try:
        return build_ai_context(db)
    except Exception:
        raise HTTPException(status_code=503, detail="Supply-chain data is temporarily unavailable.") from None


@router.post("/chat")
async def chat_with_copilot(request: CopilotRequest, snapshot: dict = Depends(get_copilot_context)):
    # Ignore client metrics, credentials and entities. Page is only a UI hint.
    page = request.context.get("current_page")
    if not isinstance(page, str) or page not in {
        "dashboard", "inventory", "suppliers", "shipments", "reports", "forecast", "analysis",
        "intelligence", "recommendations", "simulation", "risk", "digital-twin", "settings",
    }:
        page = None
    return await copilot_service.process_query(
        request.message, snapshot, [turn.model_dump() for turn in request.history], page,
    )

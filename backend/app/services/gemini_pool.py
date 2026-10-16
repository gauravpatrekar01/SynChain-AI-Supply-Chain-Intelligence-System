"""Bounded async Gemini transport, adapted from the supplied key-pool service.

Keys rotate for availability, never to evade project quotas. A 429 pauses the
whole pool because keys can share a Google project. Limits are per process;
multi-worker deployments must also enforce a shared gateway/project limit.
"""
from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import logging
import math
import re
import threading
import time
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
_API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiUnavailable(RuntimeError):
    """Only safe, application-defined reasons may cross the service boundary."""

    def __init__(self, reason: str = "unavailable", retry_after: int | None = None):
        self.reason = reason
        self.retry_after = retry_after
        super().__init__(f"Gemini service unavailable ({reason}).")


def _secret(value: Any) -> str:
    return (value.get_secret_value() if hasattr(value, "get_secret_value") else str(value or "")).strip()


def configured_keys(config=settings) -> list[str]:
    values = [_secret(getattr(config, f"GEMINI_API_KEY_{i}", "")) for i in range(1, 6)]
    values.extend(_secret(getattr(config, "GEMINI_API_KEYS", "")).split(","))
    values.append(_secret(getattr(config, "GEMINI_API_KEY", "")))
    # AI_PROVIDER_KEY is deliberately not reused: it may belong to another provider.
    return list(dict.fromkeys(value.strip() for value in values if value.strip()))


@dataclass
class GeminiKey:
    value: str = field(repr=False)
    disabled: bool = False
    cooldown_until: float = 0
    failures: int = 0


class GeminiPool:
    def __init__(self, keys: list[str] | None = None, *, config=settings,
                 transport: httpx.AsyncBaseTransport | None = None, clock=time.monotonic):
        self.config = config
        self.keys = [GeminiKey(key) for key in dict.fromkeys(keys if keys is not None else configured_keys(config)) if key]
        self._transport = transport
        self._clock = clock
        self._lock = threading.Lock()
        self._index = 0
        self._active = 0
        self._requests: deque[float] = deque()
        self._quota_cooldown_until = 0.0

    def redact(self, text: str) -> str:
        for key in self.keys:
            text = text.replace(key.value, "[REDACTED]")
        return re.sub(r"AIza[0-9A-Za-z_-]{30,}", "[REDACTED]", text)

    def _enter(self) -> None:
        with self._lock:
            if not self.keys:
                raise GeminiUnavailable("not_configured")
            if self._active >= self.config.GEMINI_MAX_CONCURRENT_REQUESTS:
                raise GeminiUnavailable("busy", 2)
            self._active += 1

    def _select(self, tried: set[int]) -> tuple[int, GeminiKey]:
        with self._lock:
            now = self._clock()
            if self._quota_cooldown_until > now:
                raise GeminiUnavailable("rate_limited", math.ceil(self._quota_cooldown_until - now))
            while self._requests and self._requests[0] <= now - 60:
                self._requests.popleft()
            if len(self._requests) >= self.config.GEMINI_REQUESTS_PER_MINUTE:
                raise GeminiUnavailable("rate_limited", max(1, math.ceil(60 - now + self._requests[0])))
            for _ in self.keys:
                index = self._index
                self._index = (index + 1) % len(self.keys)
                key = self.keys[index]
                if index not in tried and not key.disabled and key.cooldown_until <= now:
                    self._requests.append(now)
                    return index, key
            usable = [key for key in self.keys if not key.disabled]
            if not usable:
                raise GeminiUnavailable("credentials_rejected")
            wait = min(key.cooldown_until for key in usable) - now
            raise GeminiUnavailable("cooldown", max(1, math.ceil(wait)))

    def _fail(self, key: GeminiKey, *, disabled: bool = False) -> None:
        with self._lock:
            key.failures += 1
            # A concurrent transient failure must not resurrect a rejected key.
            key.disabled = key.disabled or disabled
            key.cooldown_until = self._clock() + min(3600, self.config.GEMINI_COOLDOWN_SECONDS * 2 ** min(key.failures - 1, 5))

    def _retry_delay(self, response: httpx.Response) -> int:
        delays = [float(self.config.GEMINI_COOLDOWN_SECONDS)]
        raw = response.headers.get("Retry-After", "")
        try:
            delays.append(float(raw))
        except ValueError:
            try:
                date = parsedate_to_datetime(raw)
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
                delays.append((date - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                pass
        try:
            for detail in response.json().get("error", {}).get("details", []):
                if detail.get("@type", "").endswith("google.rpc.RetryInfo"):
                    delays.append(float(detail.get("retryDelay", "0s").removesuffix("s")))
        except (ValueError, AttributeError, TypeError):
            pass
        return math.ceil(max(delay for delay in delays if math.isfinite(delay)))

    @staticmethod
    def _invalid_key(response: httpx.Response) -> bool:
        if response.status_code in (401, 403):
            return True
        try:
            return any(detail.get("reason") in {"API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED"}
                       for detail in response.json().get("error", {}).get("details", []))
        except (ValueError, AttributeError, TypeError):
            return False

    async def generate_content_async(self, prompt: str, system_instruction: str,
                                     model: str | None = None, response_schema: Any = None,
                                     max_output_tokens: int | None = None) -> dict[str, Any]:
        model = model or self.config.GEMINI_MODEL
        if not re.fullmatch(r"[a-zA-Z0-9._-]{1,100}", model):
            raise GeminiUnavailable("invalid_model")
        if not prompt.strip() or len(prompt) + len(system_instruction) > 60000:
            raise GeminiUnavailable("invalid_input")
        generation: dict[str, Any] = {
            "temperature": 0.2,
            "maxOutputTokens": min(max_output_tokens or self.config.GEMINI_MAX_OUTPUT_TOKENS,
                                   self.config.GEMINI_MAX_OUTPUT_TOKENS),
        }
        if response_schema is not None:
            generation["responseMimeType"] = "application/json"
            generation["responseJsonSchema"] = (
                response_schema.model_json_schema() if hasattr(response_schema, "model_json_schema") else response_schema
            )
        payload = {
            "systemInstruction": {"parts": [{"text": self.redact(system_instruction)}]},
            "contents": [{"role": "user", "parts": [{"text": self.redact(prompt)}]}],
            "generationConfig": generation,
        }
        self._enter()
        try:
            return await asyncio.wait_for(self._generate(model, payload), timeout=self.config.GEMINI_REQUEST_DEADLINE_SECONDS)
        except (asyncio.TimeoutError, httpx.TimeoutException):
            raise GeminiUnavailable("timeout") from None
        finally:
            with self._lock:
                self._active -= 1

    async def _generate(self, model: str, payload: dict) -> dict[str, Any]:
        tried: set[int] = set()
        async with httpx.AsyncClient(timeout=self.config.GEMINI_TIMEOUT_SECONDS,
                                     transport=self._transport, follow_redirects=False) as client:
            for _ in range(min(len(self.keys), self.config.GEMINI_MAX_ATTEMPTS)):
                index, key = self._select(tried)
                tried.add(index)
                try:
                    response = await client.post(f"{_API_ROOT}/{model}:generateContent", json=payload,
                                                 headers={"x-goog-api-key": key.value})
                except (httpx.TransportError, httpx.TimeoutException):
                    self._fail(key)
                    logger.warning("Gemini transport or timeout error; credential placed in cooldown")
                    continue
                if response.status_code == 429:
                    delay = self._retry_delay(response)
                    with self._lock:
                        self._quota_cooldown_until = max(self._quota_cooldown_until, self._clock() + delay)
                    raise GeminiUnavailable("rate_limited", delay)
                if self._invalid_key(response):
                    self._fail(key, disabled=True)
                    logger.warning("Gemini credential rejected; disabled until pool restart")
                    continue
                if response.status_code in (408, 500, 502, 503, 504):
                    self._fail(key)
                    continue
                if response.status_code >= 400:
                    # Bad requests/model errors/safety errors do not improve on another key.
                    raise GeminiUnavailable("request_rejected")
                if response.status_code != 200:
                    raise GeminiUnavailable("invalid_response")
                try:
                    data = response.json()
                    if data.get("promptFeedback", {}).get("blockReason"):
                        raise GeminiUnavailable("blocked")
                    candidate = data.get("candidates", [])[0]
                    if candidate.get("finishReason") != "STOP":
                        raise GeminiUnavailable("incomplete_response")
                    result = "".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", [])
                                     if not part.get("thought")).strip()
                    if not result:
                        raise GeminiUnavailable("empty_response")
                except (ValueError, IndexError, AttributeError, TypeError):
                    raise GeminiUnavailable("invalid_response") from None
                with self._lock:
                    key.failures = 0
                return {"response": self.redact(result), "provider": "gemini", "model": model}
        raise GeminiUnavailable("unavailable")


gemini_pool = GeminiPool()

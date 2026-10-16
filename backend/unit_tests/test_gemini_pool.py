import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest

from app.services.gemini_pool import GeminiPool, GeminiUnavailable, configured_keys


def config(**overrides):
    defaults = dict(GEMINI_MODEL="gemini-2.5-flash", GEMINI_TIMEOUT_SECONDS=1,
                    GEMINI_REQUEST_DEADLINE_SECONDS=2, GEMINI_MAX_ATTEMPTS=3,
                    GEMINI_COOLDOWN_SECONDS=60, GEMINI_MAX_CONCURRENT_REQUESTS=2,
                    GEMINI_REQUESTS_PER_MINUTE=15, GEMINI_MAX_OUTPUT_TOKENS=1024)
    return SimpleNamespace(**(defaults | overrides))


def success(text="Recorded data response", **candidate):
    return httpx.Response(200, json={"candidates": [{"finishReason": "STOP",
                         "content": {"parts": [{"text": text}]}, **candidate}]})


def run(pool, **kwargs):
    return asyncio.run(pool.generate_content_async("question", "system", **kwargs))


def test_round_robin_deduplicates_and_keeps_credentials_out_of_url():
    sent = []
    def handler(request):
        assert request.url.host == "generativelanguage.googleapis.com"
        assert not request.url.query
        sent.append(request.headers["x-goog-api-key"])
        return success()
    pool = GeminiPool(["secret-a", "secret-b", "secret-a"], config=config(), transport=httpx.MockTransport(handler))
    for _ in range(3):
        assert run(pool)["provider"] == "gemini"
    assert sent == ["secret-a", "secret-b", "secret-a"]
    assert "secret-a" not in repr(pool.keys)


def test_missing_keys_fail_without_transport_call():
    pool = GeminiPool([], config=config(), transport=httpx.MockTransport(lambda request: pytest.fail("network call")))
    with pytest.raises(GeminiUnavailable, match="not_configured"):
        run(pool)


def test_config_dedup_and_no_other_provider_key_reuse():
    assert configured_keys(SimpleNamespace(GEMINI_API_KEY_1=" one ", GEMINI_API_KEYS="two,one", GEMINI_API_KEY="two")) == ["one", "two"]
    assert configured_keys(SimpleNamespace(AI_PROVIDER_KEY="unrelated-secret")) == []


def test_429_pauses_entire_pool_and_honors_retry_delay():
    now, calls = [100.0], []
    def handler(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, headers={"Retry-After": "90"}, json={"error": {"details": [
                {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "120.5s"}]}})
        return success()
    pool = GeminiPool(["key-a", "key-b"], config=config(), transport=httpx.MockTransport(handler), clock=lambda: now[0])
    for _ in range(2):
        with pytest.raises(GeminiUnavailable) as caught:
            run(pool)
        assert caught.value.reason == "rate_limited"
        assert caught.value.retry_after == 121
    assert len(calls) == 1
    now[0] += 122
    assert run(pool)["response"]
    assert len(calls) == 2


@pytest.mark.parametrize("status", [401, 403, 503])
def test_bad_credential_or_transient_failure_uses_next_healthy_key(status):
    sent = []
    def handler(request):
        sent.append(request.headers["x-goog-api-key"])
        return httpx.Response(status) if sent[-1] == "key-a" else success()
    pool = GeminiPool(["key-a", "key-b"], config=config(), transport=httpx.MockTransport(handler))
    assert run(pool)["response"]
    assert run(pool)["response"]
    assert sent == ["key-a", "key-b", "key-b"]
    assert pool.keys[0].disabled == (status in (401, 403))


def test_invalid_api_key_400_is_disabled_but_bad_request_is_not_retried():
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(400, json={"error": {"message": "secret-a", "details": []}})
    pool = GeminiPool(["secret-a", "secret-b"], config=config(), transport=httpx.MockTransport(handler))
    with pytest.raises(GeminiUnavailable, match="request_rejected") as caught:
        run(pool)
    assert "secret-a" not in str(caught.value)
    assert len(calls) == 1
    assert not pool.keys[0].disabled
    invalid = httpx.Response(400, json={"error": {"details": [{"reason": "API_KEY_INVALID"}]}})
    assert pool._invalid_key(invalid)


def test_exhausted_pool_never_forces_cooling_key():
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(503)
    pool = GeminiPool(["key-a", "key-b"], config=config(), transport=httpx.MockTransport(handler))
    with pytest.raises(GeminiUnavailable):
        run(pool)
    with pytest.raises(GeminiUnavailable, match="cooldown"):
        run(pool)
    assert len(calls) == 2


@pytest.mark.parametrize("response, reason", [
    (httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}), "blocked"),
    (success("", finishReason="MAX_TOKENS"), "incomplete_response"),
    (success(""), "empty_response"),
    (httpx.Response(200, text="broken json"), "invalid_response"),
    (httpx.Response(200, json={"candidates": []}), "invalid_response"),
])
def test_unusable_model_output_is_not_success(response, reason):
    pool = GeminiPool(["key"], config=config(), transport=httpx.MockTransport(lambda request: response))
    with pytest.raises(GeminiUnavailable, match=reason):
        run(pool)


def test_structured_generation_and_secret_redaction():
    schema = {"type": "object", "properties": {"answer": {"type": "string"}}}
    def handler(request):
        payload = json.loads(request.content)
        assert payload["generationConfig"]["responseJsonSchema"] == schema
        assert "actual-secret" not in json.dumps(payload)
        return success("Please do not print actual-secret")
    pool = GeminiPool(["actual-secret"], config=config(), transport=httpx.MockTransport(handler))
    result = asyncio.run(pool.generate_content_async("actual-secret", "system", response_schema=schema))
    assert result["response"] == "Please do not print [REDACTED]"


def test_local_rate_limit_counts_attempts_and_recovers():
    now = [100.0]
    pool = GeminiPool(["key"], config=config(GEMINI_REQUESTS_PER_MINUTE=1),
                      transport=httpx.MockTransport(lambda request: success()), clock=lambda: now[0])
    run(pool)
    with pytest.raises(GeminiUnavailable, match="rate_limited"):
        run(pool)
    now[0] += 61
    assert run(pool)["response"]


def test_concurrency_limit_cancellation_and_deadline_release_capacity():
    async def scenario():
        started = asyncio.Event()
        async def handler(request):
            started.set()
            await asyncio.sleep(5)
            return success()
        pool = GeminiPool(["key"], config=config(GEMINI_MAX_CONCURRENT_REQUESTS=1, GEMINI_REQUEST_DEADLINE_SECONDS=0.05),
                          transport=httpx.MockTransport(handler))
        task = asyncio.create_task(pool.generate_content_async("question", "system"))
        await started.wait()
        with pytest.raises(GeminiUnavailable, match="busy"):
            await pool.generate_content_async("question", "system")
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert pool._active == 0
        with pytest.raises(GeminiUnavailable, match="timeout"):
            await pool.generate_content_async("question", "system")
        assert pool._active == 0
    asyncio.run(scenario())


def test_concurrent_transient_failure_cannot_resurrect_rejected_key():
    async def scenario():
        first_started, release_first = asyncio.Event(), asyncio.Event()
        calls = 0
        async def handler(request):
            nonlocal calls
            calls += 1
            if calls == 1:
                first_started.set()
                await release_first.wait()
                return httpx.Response(503)
            return httpx.Response(401)
        pool = GeminiPool(["key"], config=config(), transport=httpx.MockTransport(handler))
        first = asyncio.create_task(pool.generate_content_async("question", "system"))
        await first_started.wait()
        with pytest.raises(GeminiUnavailable):
            await pool.generate_content_async("question", "system")
        release_first.set()
        with pytest.raises(GeminiUnavailable):
            await first
        with pytest.raises(GeminiUnavailable, match="credentials_rejected"):
            await pool.generate_content_async("question", "system")
        assert calls == 2
    asyncio.run(scenario())


def test_timeout_fails_key_and_rotates_to_healthy_key():
    sent = []
    def handler(request):
        key = request.headers["x-goog-api-key"]
        sent.append(key)
        if key == "key-timeout":
            raise httpx.ReadTimeout("timed out waiting for response")
        return success("recovered on second key")
    pool = GeminiPool(["key-timeout", "key-healthy"], config=config(), transport=httpx.MockTransport(handler))
    result = run(pool)
    assert result["response"] == "recovered on second key"
    assert sent == ["key-timeout", "key-healthy"]
    assert pool.keys[0].failures == 1
    assert pool.keys[0].cooldown_until > 0


def test_system_instruction_redacts_keys():
    observed = []
    def handler(request):
        payload = json.loads(request.content)
        observed.append(payload["systemInstruction"]["parts"][0]["text"])
        return success("system redacted")
    pool = GeminiPool(["super-secret-key-12345"], config=config(), transport=httpx.MockTransport(handler))
    asyncio.run(pool.generate_content_async("prompt", "Rules with super-secret-key-12345 inside"))
    assert observed == ["Rules with [REDACTED] inside"]


"""SMTP and route regressions; all delivery and database access are fakes."""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import parse_qs, urlsplit

import aiosmtplib
import pytest
from fastapi import FastAPI, BackgroundTasks
from fastapi.testclient import TestClient

from app.services import email_service as mail


@pytest.fixture
def smtp_setup(monkeypatch):
    config = SimpleNamespace(
        SMTP_HOST="smtp.example.com", SMTP_PORT=587,
        SMTP_USERNAME="sender@example.com", SMTP_USER="",
        SMTP_PASSWORD="private-smtp-password", SMTP_FROM_EMAIL="sender@example.com",
        SMTP_FROM_NAME="SynChain AI", SMTP_TIMEOUT_SECONDS=0.2,
        SMTP_MAX_ATTEMPTS=3, SMTP_RETRY_DELAY_SECONDS=0,
        FRONTEND_URL="https://synchain.example.com/",
    )
    monkeypatch.setattr(mail, "settings", config)
    clients = []
    outcomes = []

    class FakeSMTP:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.behavior = outcomes.pop(0) if outcomes else {}
            self.messages = []
            self.closed = False
            clients.append(self)

        async def connect(self):
            if "connect" in self.behavior:
                raise self.behavior["connect"]

        async def send_message(self, message, **kwargs):
            self.messages.append(message)
            if "sleep" in self.behavior:
                await asyncio.sleep(self.behavior["sleep"])
            if "send" in self.behavior:
                raise self.behavior["send"]
            return self.behavior.get("refused", {}), "accepted"

        async def quit(self):
            if "quit" in self.behavior:
                raise self.behavior["quit"]

        def close(self):
            self.closed = True

    monkeypatch.setattr(mail.aiosmtplib, "SMTP", FakeSMTP)
    return config, clients, outcomes


def send():
    return asyncio.run(mail.send_verification_email("customer@example.com", "secret-token"))


def test_missing_smtp_is_safe_and_truthful(smtp_setup):
    config, clients, _ = smtp_setup
    config.SMTP_PASSWORD = ""
    assert send()["status"] == "not_configured"
    assert not clients


@pytest.mark.parametrize("port,use_tls,start_tls", [(465, True, False), (587, False, True)])
def test_secure_tls_modes_and_multipart(smtp_setup, port, use_tls, start_tls):
    config, clients, _ = smtp_setup
    config.SMTP_PORT = port
    assert send()["success"] is True
    client = clients[0]
    assert client.kwargs["use_tls"] is use_tls
    assert client.kwargs["start_tls"] is start_tls
    assert client.kwargs["validate_certs"] is True
    assert client.kwargs["timeout"] == config.SMTP_TIMEOUT_SECONDS
    assert client.closed
    message = client.messages[0]
    assert message.get_body(preferencelist=("plain",)) is not None
    assert message.get_body(preferencelist=("html",)) is not None
    assert message["Message-ID"]


def test_reference_smtp_user_alias(smtp_setup):
    config, clients, _ = smtp_setup
    config.SMTP_USERNAME = ""
    config.SMTP_USER = "alias@example.com"
    assert send()["success"]
    assert clients[0].kwargs["username"] == "alias@example.com"


def test_retry_only_transient_rejection_and_preserve_message_id(smtp_setup):
    _, clients, outcomes = smtp_setup
    outcomes.extend([{"send": aiosmtplib.SMTPDataError(451, "try later")}, {}])
    result = send()
    assert result["success"] and result["retries"] == 1
    assert len(clients) == 2
    assert clients[0].messages[0]["Message-ID"] == clients[1].messages[0]["Message-ID"]
    assert all(client.closed for client in clients)


def test_transient_connect_failure_has_bounded_retries(smtp_setup):
    _, clients, outcomes = smtp_setup
    outcomes.extend([{"connect": aiosmtplib.SMTPConnectError("offline")}] * 4)
    result = send()
    assert result["status"] == "unavailable" and result["retries"] == 2
    assert len(clients) == 3
    assert not any(client.messages for client in clients)


@pytest.mark.parametrize("failure,expected", [
    (aiosmtplib.SMTPDataError(550, "rejected"), "rejected"),
    (aiosmtplib.SMTPServerDisconnected("connection lost"), "delivery_unknown"),
    (TimeoutError("timeout"), "delivery_unknown"),
])
def test_no_duplicate_retry_after_permanent_or_uncertain_send(smtp_setup, failure, expected):
    _, clients, outcomes = smtp_setup
    outcomes.append({"send": failure})
    assert send()["status"] == expected
    assert len(clients) == 1


def test_send_deadline_is_unknown_and_never_retried(smtp_setup):
    config, clients, outcomes = smtp_setup
    config.SMTP_TIMEOUT_SECONDS = 0.01
    outcomes.append({"sleep": 1})
    assert send()["status"] == "delivery_unknown"
    assert len(clients) == 1 and clients[0].closed


def test_auth_failure_does_not_retry_or_leak_server_reply(smtp_setup, caplog):
    config, clients, outcomes = smtp_setup
    sensitive_reply = f"{config.SMTP_PASSWORD} customer@example.com secret-token"
    outcomes.append({"connect": aiosmtplib.SMTPAuthenticationError(535, sensitive_reply)})
    result = send()
    assert result["status"] == "authentication_failed"
    assert len(clients) == 1
    for sensitive in (config.SMTP_PASSWORD, "customer@example.com", "secret-token"):
        assert sensitive not in str(result) + caplog.text


def test_quit_error_does_not_change_acceptance(smtp_setup):
    _, clients, outcomes = smtp_setup
    outcomes.append({"quit": aiosmtplib.SMTPServerDisconnected("already accepted")})
    assert send()["status"] == "accepted"
    assert len(clients) == 1 and clients[0].closed


def test_templates_escape_context_and_encode_tokens(smtp_setup):
    malicious = '\"><img src=x onerror=alert(1)>&next=evil'
    plain, html = mail._render_template("verification", {"token": malicious})
    assert "<img" not in html
    link = mail._account_link("/verify-email", malicious)
    assert parse_qs(urlsplit(link).query) == {"token": [malicious]}
    _, notification = mail._render_template("notification", {"title": malicious, "message": "<script>bad()</script>"})
    assert "<script>" not in notification and "&lt;script&gt;" in notification
    assert "24 hours" in plain


@pytest.mark.parametrize("url", ["javascript:alert(1)", "http://remote.example.com", "https://user:pass@example.com", "https://example.com/?token=bad"])
def test_invalid_frontend_does_not_send(smtp_setup, url):
    config, clients, _ = smtp_setup
    config.FRONTEND_URL = url
    assert send()["status"] == "invalid_message"
    assert not clients


def test_injected_subject_and_template_path_are_rejected(smtp_setup):
    _, clients, _ = smtp_setup
    result = asyncio.run(mail.email_service.send_email("customer@example.com", "Subject\r\nBcc: victim@example.com", "report", {}))
    assert result["status"] == "invalid_message"
    result = asyncio.run(mail.email_service.send_email("customer@example.com", "Subject", "../../.env", {}))
    assert result["status"] == "invalid_message" and not clients


@pytest.fixture
def email_route(monkeypatch):
    from app.api.deps import get_current_active_user
    from app.api.v1 import test_email
    app = FastAPI()
    app.include_router(test_email.router)
    sender = AsyncMock(return_value=mail._result("accepted", "Accepted by SMTP."))
    monkeypatch.setattr(test_email.email_service, "send_email", sender)
    return TestClient(app), app, get_current_active_user, sender


def test_test_email_requires_authentication(email_route):
    client, _, _, sender = email_route
    assert client.post("/test-email", json={"email": "admin@example.com"}).status_code == 401
    sender.assert_not_called()


@pytest.mark.parametrize("role,recipient", [("user", "admin@example.com"), ("admin", "other@example.com")])
def test_test_email_cannot_relay_to_arbitrary_addresses(email_route, role, recipient):
    client, app, dependency, sender = email_route
    app.dependency_overrides[dependency] = lambda: SimpleNamespace(role=role, email="admin@example.com")
    assert client.post("/test-email", json={"email": recipient}).status_code == 403
    sender.assert_not_called()


def test_test_email_reports_failure_and_acceptance_truthfully(email_route):
    client, app, dependency, sender = email_route
    app.dependency_overrides[dependency] = lambda: SimpleNamespace(role="admin", email="admin@example.com")
    assert client.post("/test-email", json={"email": "admin@example.com"}).json()["status"] == "accepted"
    sender.return_value = mail._result("not_configured", "Email service is not configured.")
    response = client.post("/test-email", json={"email": "admin@example.com"})
    assert response.status_code == 503
    assert response.json()["detail"] == "Email service is not configured."


def _auth_db(user, latest=None):
    db = MagicMock()
    user_query = MagicMock()
    user_query.filter.return_value.with_for_update.return_value.first.return_value = user
    token_query = MagicMock()
    token_query.filter.return_value.order_by.return_value.first.return_value = latest
    db.query.side_effect = [user_query, token_query]
    return db


def test_resend_creates_hashed_expiring_token_and_schedules_send(monkeypatch):
    from app.services import auth_service
    user = SimpleNamespace(id="user-id", email="customer@example.com", is_verified=False, is_active=True)
    db = _auth_db(user)
    sender = AsyncMock()
    monkeypatch.setattr(auth_service, "send_verification_email", sender)
    background = BackgroundTasks()
    asyncio.run(auth_service.AuthService(db).resend_verification(" customer@example.com ", background))
    db.commit.assert_called_once()
    token = db.add.call_args.args[0]
    assert token.user_id == user.id
    assert datetime.now(timezone.utc) + timedelta(hours=23) < token.expires_at
    assert len(background.tasks) == 1
    raw_token = background.tasks[0].args[1]
    assert token.token_hash != raw_token
    assert token.token_hash == auth_service.hash_token(raw_token)
    assert user.is_verified is False
    sender.assert_not_awaited()
    asyncio.run(background())
    sender.assert_awaited_once_with(user.email, raw_token)


@pytest.mark.parametrize("kind", ["missing", "verified", "inactive", "cooldown"])
def test_resend_avoids_enumeration_and_repeated_messages(kind):
    from app.services.auth_service import AuthService
    user = None if kind == "missing" else SimpleNamespace(
        id="user-id", email="customer@example.com", is_verified=kind == "verified", is_active=kind != "inactive",
    )
    latest = SimpleNamespace(created_at=datetime.now(timezone.utc)) if kind == "cooldown" else None
    db = _auth_db(user, latest)
    background = BackgroundTasks()
    assert asyncio.run(AuthService(db).resend_verification("customer@example.com", background)) is None
    db.add.assert_not_called()
    assert not background.tasks


def test_resend_route_schedules_service_without_exposing_status(monkeypatch):
    from app.api.v1 import auth
    from app.api.deps import get_db
    app = FastAPI()
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    resend = AsyncMock()
    monkeypatch.setattr(auth.AuthService, "resend_verification", resend)
    response = TestClient(app).post("/resend-verification", json={"email": "customer@example.com"})
    assert response.status_code == 200
    assert "If the account" in response.json()["message"]
    resend.assert_awaited_once()


@pytest.mark.parametrize("aware", [True, False])
def test_account_token_expiry_supports_postgres_and_naive_timestamps(aware):
    from app.services.auth_service import AuthService
    user = SimpleNamespace(is_verified=False)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    token = SimpleNamespace(expires_at=expiry if aware else expiry.replace(tzinfo=None), user_id="id", used=False)
    db = MagicMock()
    first, second = MagicMock(), MagicMock()
    first.filter.return_value.first.return_value = token
    second.filter.return_value.first.return_value = user
    db.query.side_effect = [first, second]
    assert AuthService(db).verify_email("token") is True
    assert user.is_verified and token.used

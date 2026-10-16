"""Transactional mail with validated TLS, safe templates and bounded attempts.

SMTP acceptance acknowledges the relay, not delivery to an inbox. A connection
lost during sending has an unknown outcome and is never retried here.
"""
import asyncio
import logging
import math
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html import escape
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit

import aiosmtplib
from pydantic import EmailStr, TypeAdapter

from app.core.config import settings

logger = logging.getLogger(__name__)
_email_address = TypeAdapter(EmailStr)


@dataclass(frozen=True, repr=False)
class _SMTPConfig:
    host: str
    port: int
    username: str
    password: str
    sender: str
    sender_name: str
    timeout: float
    attempts: int
    retry_delay: float


def _result(status: str, message: str, attempts: int = 0) -> dict[str, Any]:
    return {
        "success": status == "accepted",
        "status": status,
        "error": None if status == "accepted" else status.upper(),
        "message": message,
        "retries": max(0, attempts - 1),
    }


def _config() -> _SMTPConfig | None:
    """Missing email setup must not break application startup."""
    username = settings.SMTP_USERNAME or getattr(settings, "SMTP_USER", "")
    sender = settings.SMTP_FROM_EMAIL or username
    if not all((settings.SMTP_HOST, username, settings.SMTP_PASSWORD, sender)):
        return None
    timeout = float(getattr(settings, "SMTP_TIMEOUT_SECONDS", 10.0))
    delay = float(getattr(settings, "SMTP_RETRY_DELAY_SECONDS", 0.5))
    attempts = int(getattr(settings, "SMTP_MAX_ATTEMPTS", 3))
    port = int(settings.SMTP_PORT)
    if not (1 <= port <= 65535 and math.isfinite(timeout) and 0 < timeout <= 60):
        raise ValueError("Invalid SMTP port or timeout")
    if not (1 <= attempts <= 5 and math.isfinite(delay) and 0 <= delay <= 10):
        raise ValueError("Invalid SMTP retry configuration")
    if any(c in settings.SMTP_HOST + settings.SMTP_FROM_NAME for c in "\r\n"):
        raise ValueError("Invalid SMTP headers")
    return _SMTPConfig(
        host=settings.SMTP_HOST.strip(), port=port, username=username,
        password=settings.SMTP_PASSWORD,
        sender=str(_email_address.validate_python(sender)),
        sender_name=settings.SMTP_FROM_NAME, timeout=timeout,
        attempts=attempts, retry_delay=delay,
    )


def _account_link(path: str, token: str) -> str:
    base = urlsplit(settings.FRONTEND_URL.strip())
    local = base.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        not base.hostname or base.username or base.password or base.query or base.fragment
        or (base.scheme != "https" and not (base.scheme == "http" and local))
    ):
        raise ValueError("FRONTEND_URL requires HTTPS (HTTP is allowed on localhost)")
    if not isinstance(token, str) or not token or len(token) > 8192 or any(c in token for c in "\r\n"):
        raise ValueError("Invalid account token")
    return urlunsplit((base.scheme, base.netloc, base.path.rstrip("/") + path, urlencode({"token": token}), ""))


def _render_template(template: str, context: dict[str, Any]) -> tuple[str, str]:
    """Allowlisted templates; context cannot become HTML or a filesystem path."""
    if template == "verification":
        title = "Welcome to SynChain AI!"
        body = "Please confirm your email address to activate your account."
        button = "Verify Email Address"
        footer = "This link expires in 24 hours. If you did not create this account, ignore this email."
        link = _account_link("/verify-email", context.get("token"))
    elif template == "password_reset":
        title = "SynChain AI Password Reset"
        body = "We received a request to reset your password. Use the link below to choose a new one."
        button = "Reset Password"
        footer = "This link expires in 30 minutes. If you did not request a password reset, ignore this email."
        link = _account_link("/reset-password", context.get("token"))
    elif template in {"notification", "report"}:
        title = str(context.get("title", "SynChain AI notification"))[:200]
        body = str(context.get("message", ""))[:20000]
        footer = "Sent by SynChain AI."
        button, link = "", ""
    else:
        raise ValueError("Unknown email template")
    action = f'<p><a href="{escape(link, quote=True)}">{escape(button)}</a></p>' if link else ""
    html = (
        '<html><body><main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">'
        f'<h2>{escape(title)}</h2><p>{escape(body).replace(chr(10), "<br>")}</p>{action}'
        f'<p style="font-size:12px;color:#475569">{escape(footer)}</p>'
        '</main></body></html>'
    )
    plain = "\n\n".join(part for part in (title, body, f"{button}: {link}" if link else "", footer) if part)
    return plain, html


def _failure(exc: Exception, delivery_started: bool) -> tuple[str, bool]:
    """Retry only known transient rejections or failures before sending begins."""
    if isinstance(exc, aiosmtplib.SMTPAuthenticationError):
        return "authentication_failed", False
    if isinstance(exc, (ssl.SSLError, aiosmtplib.SMTPNotSupported)):
        return "tls_failed", False
    if isinstance(exc, aiosmtplib.SMTPRecipientsRefused):
        return "rejected", bool(exc.recipients) and all(400 <= item.code < 500 for item in exc.recipients)
    if isinstance(exc, aiosmtplib.SMTPResponseException):
        return "rejected", 400 <= exc.code < 500
    if delivery_started:
        return "delivery_unknown", False
    if isinstance(exc, (OSError, aiosmtplib.SMTPConnectError, aiosmtplib.SMTPTimeoutError, aiosmtplib.SMTPServerDisconnected)):
        return "unavailable", True
    return "unavailable", False


class EmailService:
    async def send_email(
        self, to_email: str, subject: str, template_name: str,
        context: dict[str, Any], max_retries: int | None = None,
    ) -> dict[str, Any]:
        """Return safe status without addresses, tokens or raw server replies.

        ``max_retries`` follows the reference service convention of total attempts;
        it is capped by SMTP_MAX_ATTEMPTS and never exceeds five.
        """
        try:
            config = _config()
        except (ValueError, TypeError):
            logger.warning("SMTP configuration is invalid")
            return _result("invalid_configuration", "Email service configuration is invalid.")
        if config is None:
            logger.warning("SMTP is not configured")
            return _result("not_configured", "Email service is not configured.")
        try:
            recipient = str(_email_address.validate_python(to_email))
            if not isinstance(subject, str) or not subject.strip() or len(subject) > 200:
                raise ValueError("Invalid subject")
            plain, html = _render_template(template_name, context)
            message = EmailMessage()
            message["From"] = formataddr((config.sender_name, config.sender))
            message["To"] = recipient
            message["Subject"] = subject
            message["Date"] = formatdate(localtime=False)
            # Preserve the Message-ID across known-safe retries.
            message["Message-ID"] = make_msgid(domain=config.sender.rsplit("@", 1)[1])
            message.set_content(plain)
            message.add_alternative(html, subtype="html")
            attempts = config.attempts if max_retries is None else min(config.attempts, max(1, int(max_retries)))
        except (ValueError, TypeError, AttributeError):
            return _result("invalid_message", "Email message could not be prepared.")

        for attempt in range(1, attempts + 1):
            smtp = None
            delivery_started = False
            accepted = False
            try:
                smtp = aiosmtplib.SMTP(
                    hostname=config.host, port=config.port,
                    username=config.username, password=config.password,
                    use_tls=config.port == 465, start_tls=config.port != 465,
                    validate_certs=True, timeout=config.timeout,
                )
                # Bound the whole connection/auth/send attempt, not each command only.
                async with asyncio.timeout(config.timeout):
                    await smtp.connect()
                    delivery_started = True
                    refused, _ = await smtp.send_message(message, sender=config.sender, recipients=[recipient])
                    accepted = not refused
                if not accepted:
                    return _result("rejected", "The SMTP server rejected the recipient.", attempt)
                logger.info("SMTP accepted a transactional message")
                return _result("accepted", "Email accepted by the SMTP server for delivery.", attempt)
            except Exception as exc:
                status, retryable = _failure(exc, delivery_started)
                # Exception text can contain credentials, recipient addresses or tokens.
                logger.warning("SMTP send outcome=%s attempt=%s", status, attempt)
                if not retryable or attempt == attempts:
                    messages = {
                        "delivery_unknown": "SMTP delivery could not be confirmed; the message was not retried.",
                        "authentication_failed": "Email service authentication failed.",
                        "tls_failed": "A secure connection to the email service could not be established.",
                        "rejected": "The SMTP server rejected the message.",
                        "unavailable": "Email service is temporarily unavailable.",
                    }
                    return _result(status, messages[status], attempt)
            finally:
                if smtp is not None:
                    # A failed QUIT after acceptance must never trigger another send.
                    try:
                        if accepted:
                            await asyncio.wait_for(smtp.quit(), timeout=min(config.timeout, 2.0))
                    except Exception:
                        pass
                    finally:
                        smtp.close()
            await asyncio.sleep(min(config.retry_delay * 2 ** (attempt - 1), 10.0))


email_service = EmailService()


async def send_verification_email(email_to: str, token: str) -> dict[str, Any]:
    return await email_service.send_email(
        email_to, "Verify your SynChain AI Account", "verification", {"token": token},
    )


async def send_password_reset_email(email_to: str, token: str) -> dict[str, Any]:
    return await email_service.send_email(
        email_to, "SynChain AI - Password Reset Request", "password_reset", {"token": token},
    )

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# FastAPI-Mail config
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USERNAME,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.SMTP_FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_HOST,
    MAIL_FROM_NAME=settings.SMTP_FROM_NAME,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_verification_email(email_to: str, token: str):
    """Sends an email verification link to the user."""
    # Note: In production we would use a proper jinja template
    verification_link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html_content = f"""
    <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b1120; color: #f8fafc; border-radius: 8px;">
                <h2 style="color: #38bdf8;">Welcome to SynChain AI!</h2>
                <p>Thank you for registering. Please confirm your email address to activate your account.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_link}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">If you did not create this account, please ignore this email.</p>
                <p style="font-size: 12px; color: #94a3b8;">Link expires in 24 hours.</p>
            </div>
        </body>
    </html>
    """
    message = MessageSchema(
        subject="Verify your SynChain AI Account",
        recipients=[email_to],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        logger.error(f"Failed to send verification email to {email_to}: {e}")
        # Optionally raise or handle email failures gracefully

async def send_password_reset_email(email_to: str, token: str):
    """Sends a password reset link to the user."""
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html_content = f"""
    <html>
        <body>
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0b1120; color: #f8fafc; border-radius: 8px;">
                <h2 style="color: #38bdf8;">SynChain AI Password Reset</h2>
                <p>We received a request to reset your password. Click the button below to choose a new one.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">If you did not request a password reset, please safely ignore this email.</p>
                <p style="font-size: 12px; color: #94a3b8;">Link expires in 30 minutes.</p>
            </div>
        </body>
    </html>
    """
    message = MessageSchema(
        subject="SynChain AI - Password Reset Request",
        recipients=[email_to],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email_to}: {e}")

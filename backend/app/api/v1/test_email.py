from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import uuid
from app.services.email_service import send_verification_email

router = APIRouter()

class TestEmailRequest(BaseModel):
    email: EmailStr

@router.post("/test-email", summary="Send a test email via SMTP", response_model=dict)
async def send_test_email(request: TestEmailRequest):
    """Send a verification email to the provided address.
    Uses a dummy token; the email content will be the standard verification template.
    Returns a clear success or failure message.
    """
    token = str(uuid.uuid4())
    try:
        await send_verification_email(request.email, token)
        return {"detail": "Test email sent successfully"}
    except Exception as exc:
        # Do NOT log the SMTP_PASSWORD; email_service already handles errors safely.
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {exc}")

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.api.deps import get_current_active_user
from app.models.postgres.models import User
from app.services.email_service import email_service

router = APIRouter()


class TestEmailRequest(BaseModel):
    email: EmailStr


@router.post("/test-email", summary="Send an SMTP test to the signed-in administrator", response_model=dict)
async def send_test_email(
    request: TestEmailRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Administrators may test their own address; this endpoint is not a mail relay."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    if request.email.lower() != current_user.email.strip().lower():
        raise HTTPException(status_code=403, detail="Test email can only be sent to your own account.")

    result = await email_service.send_email(
        current_user.email, "SynChain AI - SMTP configuration test", "notification",
        {"title": "SynChain AI email test", "message": "Your SMTP server accepted a test from SynChain AI."},
        max_retries=1,
    )
    if not result["success"]:
        raise HTTPException(status_code=503, detail=result["message"])
    return {"detail": result["message"], "status": result["status"]}

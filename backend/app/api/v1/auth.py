from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional

from app.api.deps import get_db, get_current_active_user
from app.schemas.auth import (
    UserCreate, UserResponse, UserLogin, Token, 
    ForgotPasswordRequest, ResetPasswordRequest, 
    VerifyEmailRequest, ResendVerificationRequest
)
from app.services.auth_service import AuthService
from app.core.security import create_access_token
from app.models.postgres.models import User

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Register a new user. Dispatches verification email in the background.
    """
    auth_service = AuthService(db)
    user = await auth_service.register_user(user_in, background_tasks=background_tasks)
    return user

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    OAuth2 and JSON compatible token login.
    Accepts JSON body ({email, password}) or form data ({username/email, password}).
    """
    email = None
    password = None

    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")
    else:
        try:
            body = await request.json()
            if isinstance(body, dict):
                email = body.get("email") or body.get("username")
                password = body.get("password")
        except Exception:
            pass

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both email and password are required."
        )

    auth_service = AuthService(db)
    user = auth_service.authenticate_user(email, password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
        
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user.
    """
    return current_user

@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verify email address using token.
    """
    auth_service = AuthService(db)
    auth_service.verify_email(request.token)
    return {"message": "Email successfully verified."}

@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Resend verification email.
    """
    await AuthService(db).resend_verification(request.email, background_tasks=background_tasks)
    return {"message": "If the account needs verification, a verification email will be sent. Please allow a minute between requests."}

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Initiate password reset flow.
    """
    auth_service = AuthService(db)
    await auth_service.initiate_password_reset(request.email)
    # Always return a generic success message
    return {"message": "If the account exists, a password reset link has been sent."}

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using token.
    """
    auth_service = AuthService(db)
    auth_service.reset_password(request.token, request.new_password)
    return {"message": "Password has been successfully reset."}

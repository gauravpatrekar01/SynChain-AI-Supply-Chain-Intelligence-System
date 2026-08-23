from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
import uuid

class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenPayload(BaseModel):
    sub: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    is_verified: bool
    is_active: bool
    role: str
    avatar_url: Optional[str] = None
    department: Optional[str] = None
    access_tier: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    onboarding_completed: bool = False

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

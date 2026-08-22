from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone

from app.models.postgres.models import User, PasswordResetToken, EmailVerificationToken
from app.schemas.auth import UserCreate
from app.core.security import (
    get_password_hash, 
    verify_password, 
    generate_secure_token, 
    hash_token
)
from app.services.email_service import send_verification_email, send_password_reset_email

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    async def register_user(self, user_in: UserCreate) -> User:
        # Check if email exists
        existing_user = self.db.query(User).filter(User.email == user_in.email.lower()).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="The user with this email already exists in the system."
            )
        
        # Create user
        db_user = User(
            email=user_in.email.lower(),
            name=user_in.name,
            password_hash=get_password_hash(user_in.password),
            is_active=True,
            is_verified=False
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)

        # Generate Verification Token
        raw_token = generate_secure_token()
        hashed_token = hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        verify_token_obj = EmailVerificationToken(
            user_id=db_user.id,
            token_hash=hashed_token,
            expires_at=expires_at
        )
        self.db.add(verify_token_obj)
        self.db.commit()

        # Send Email
        await send_verification_email(db_user.email, raw_token)

        return db_user

    def authenticate_user(self, email: str, password: str) -> User:
        user = self.db.query(User).filter(User.email == email.lower()).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        
        # Update last login
        user.last_login = datetime.now(timezone.utc)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user

    def verify_email(self, token: str) -> bool:
        token_hash = hash_token(token)
        db_token = self.db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token_hash == token_hash,
            EmailVerificationToken.used == False
        ).first()

        if not db_token:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        
        # In SQLite/Postgres naive datetimes vs timezone datetimes comparison can be tricky, 
        # so ensure tz info is handled if necessary.
        if db_token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(status_code=400, detail="Verification token has expired")

        user = self.db.query(User).filter(User.id == db_token.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.is_verified = True
        db_token.used = True
        self.db.commit()
        return True

    async def initiate_password_reset(self, email: str) -> None:
        user = self.db.query(User).filter(User.email == email.lower()).first()
        if not user:
            # Silently return to not reveal user existence
            return

        raw_token = generate_secure_token()
        hashed_token = hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        reset_token_obj = PasswordResetToken(
            user_id=user.id,
            token_hash=hashed_token,
            expires_at=expires_at
        )
        self.db.add(reset_token_obj)
        self.db.commit()

        await send_password_reset_email(user.email, raw_token)

    def reset_password(self, token: str, new_password: str) -> None:
        token_hash = hash_token(token)
        db_token = self.db.query(PasswordResetToken).filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False
        ).first()

        if not db_token:
            raise HTTPException(status_code=400, detail="Invalid reset token")

        if db_token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
            raise HTTPException(status_code=400, detail="Reset token has expired")

        user = self.db.query(User).filter(User.id == db_token.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.password_hash = get_password_hash(new_password)
        db_token.used = True
        self.db.commit()

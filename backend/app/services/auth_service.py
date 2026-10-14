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

    async def register_user(self, user_in: UserCreate, background_tasks=None) -> User:
        clean_email = user_in.email.strip().lower()
        # Check if email exists
        existing_user = self.db.query(User).filter(User.email == clean_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The user with this email already exists in the system."
            )
        
        try:
            # Create user
            db_user = User(
                email=clean_email,
                name=user_in.name.strip(),
                password_hash=get_password_hash(user_in.password),
                is_active=True,
                is_verified=False,
                role="user"
            )
            self.db.add(db_user)
            self.db.flush()

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
            self.db.refresh(db_user)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The user with this email already exists in the system."
            )
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to register user: {str(e)}"
            )

        # Dispatch email asynchronously in background so client receives fast response
        if background_tasks:
            background_tasks.add_task(send_verification_email, db_user.email, raw_token)
        else:
            try:
                await send_verification_email(db_user.email, raw_token)
            except Exception:
                pass

        return db_user

    def authenticate_user(self, email: str, password: str) -> User:
        clean_email = email.strip().lower()
        user = self.db.query(User).filter(User.email == clean_email).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        
        # Update last login
        try:
            user.last_login = datetime.now(timezone.utc)
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        except Exception:
            self.db.rollback()
        
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

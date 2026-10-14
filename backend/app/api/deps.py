from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import verify_token
from app.models.postgres.models import User
from jose import JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login")

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    import uuid
    user = None
    try:
        try:
            val_uuid = uuid.UUID(str(user_id))
            user = db.query(User).filter(User.id == val_uuid).first()
        except (ValueError, AttributeError):
            user = db.query(User).filter(User.email == str(user_id)).first()
    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception
        
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login", auto_error=False)


def get_optional_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme_optional)
) -> User | None:
    if not token:
        return None
    try:
        payload = verify_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        import uuid
        try:
            val_uuid = uuid.UUID(str(user_id))
            user = db.query(User).filter(User.id == val_uuid).first()
        except (ValueError, AttributeError):
            user = db.query(User).filter(User.email == str(user_id)).first()
        if user and user.is_active:
            return user
        return None
    except Exception:
        return None

from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings
import hashlib
import secrets
import base64
from cryptography.fernet import Fernet

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verifies a JWT token and returns the payload if valid."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None

def generate_secure_token() -> str:
    """Generates a secure cryptographically random token."""
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    """Hashes a secure token for database storage."""
    return hashlib.sha256(token.encode()).hexdigest()

def _integration_cipher() -> Fernet:
    key = settings.INTEGRATION_ENCRYPTION_KEY
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.JWT_SECRET.encode()).digest()).decode()
    return Fernet(key.encode())

def encrypt_secret(value: str) -> str:
    return _integration_cipher().encrypt(value.encode()).decode()

def decrypt_secret(value: str) -> str:
    return _integration_cipher().decrypt(value.encode()).decode()

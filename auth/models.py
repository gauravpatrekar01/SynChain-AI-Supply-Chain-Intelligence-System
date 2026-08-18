from sqlalchemy import Column, Integer, String, Boolean, DateTime
from auth_database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(200), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(50), default="user", nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)

    token = Column(String(500), unique=True, index=True, nullable=False)

    username = Column(String(200), nullable=False)

    expires_at = Column(DateTime, nullable=False)

    revoked = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

from sqlalchemy import Column, Integer, String
from auth_database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(200), unique=True, index=True)
    email = Column(String(200), unique=True, index=True)
    hashed_password = Column(String(200))
    role = Column(String(200), default="user")

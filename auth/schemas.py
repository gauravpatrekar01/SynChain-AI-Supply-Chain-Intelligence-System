from pydantic import BaseModel, EmailStr

# Schema for new user


class userCreate(BaseModel):
    id: int
    username: str
    email: str
    password: str
    role: str

# Schema for user login


class userLogin(BaseModel):
    username: str
    password: str

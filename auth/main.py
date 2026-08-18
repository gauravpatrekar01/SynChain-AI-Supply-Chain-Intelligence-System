from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status
)

from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer
)

from sqlalchemy.orm import Session

from jose import jwt, JWTError

from datetime import datetime, timedelta

import secrets
import os

from dotenv import load_dotenv

import models
import schemas
import utils

from auth_database import (
    get_db,
    Base,
    engine
)


# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "30"
    )
)

REFRESH_TOKEN_EXPIRE_DAYS = int(
    os.getenv(
        "REFRESH_TOKEN_EXPIRE_DAYS",
        "7"
    )
)


if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY is missing from .env"
    )


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="FastAPI JWT Authentication"
)


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# OAUTH2
# ============================================================

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="login"
)


# ============================================================
# PASSWORD FUNCTIONS
# ============================================================

def hash_password(password: str):

    return utils.hash_password(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):

    return utils.verify_password(
        plain_password,
        hashed_password
    )


# ============================================================
# CREATE ACCESS TOKEN
# ============================================================

def create_access_token(
    username: str,
    role: str
):

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": username,
        "role": role,
        "type": "access",
        "exp": expire
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token


# ============================================================
# CREATE REFRESH TOKEN
# ============================================================

def create_refresh_token(
    username: str,
    db: Session
):

    token = secrets.token_urlsafe(64)

    expires_at = datetime.utcnow() + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    refresh_token = models.RefreshToken(
        token=token,
        username=username,
        expires_at=expires_at,
        revoked=False
    )

    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)

    return token


# ============================================================
# GET CURRENT USER FROM ACCESS TOKEN
# ============================================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        username = payload.get("sub")

        token_type = payload.get("type")

        if username is None:
            raise credentials_exception

        if token_type != "access":
            raise credentials_exception

    except JWTError:

        raise credentials_exception


    # ========================================================
    # CHECK USER EXISTS
    # ========================================================

    user = db.query(
        models.User
    ).filter(
        models.User.username == username
    ).first()


    if not user:

        raise credentials_exception


    return user


# ============================================================
# REGISTER
# ============================================================

@app.post("/register")
def register(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):

    # Check username

    existing_user = db.query(
        models.User
    ).filter(
        models.User.username == user_data.username
    ).first()


    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )


    # Check email

    existing_email = db.query(
        models.User
    ).filter(
        models.User.email == user_data.email
    ).first()


    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )


    # Hash password

    hashed_password = hash_password(
        user_data.password
    )


    # Create user

    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role="user"
    )


    db.add(new_user)

    db.commit()

    db.refresh(new_user)


    return {

        "message": "User registered successfully",

        "username": new_user.username,

        "email": new_user.email,

        "role": new_user.role
    }


# ============================================================
# LOGIN
# ============================================================

@app.post(
    "/login",
    response_model=schemas.TokenResponse
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),

    db: Session = Depends(get_db)
):

    # Find user

    user = db.query(
        models.User
    ).filter(
        models.User.username == form_data.username
    ).first()


    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )


    # Verify password

    if not verify_password(
        form_data.password,
        user.hashed_password
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )


    # Create access token

    access_token = create_access_token(
        username=user.username,
        role=user.role
    )


    # Create refresh token

    refresh_token = create_refresh_token(
        username=user.username,
        db=db
    )


    return {

        "access_token": access_token,

        "refresh_token": refresh_token,

        "token_type": "bearer"
    }


# ============================================================
# REFRESH ACCESS TOKEN
# ============================================================

@app.post(
    "/refresh",
    response_model=schemas.TokenResponse
)
def refresh_access_token(
    request: schemas.RefreshRequest,
    db: Session = Depends(get_db)
):

    refresh_token = db.query(
        models.RefreshToken
    ).filter(
        models.RefreshToken.token ==
        request.refresh_token
    ).first()


    # Token doesn't exist

    if not refresh_token:

        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token"
        )


    # Token revoked

    if refresh_token.revoked:

        raise HTTPException(
            status_code=401,
            detail="Refresh token has been revoked"
        )


    # Token expired

    if refresh_token.expires_at < datetime.utcnow():

        raise HTTPException(
            status_code=401,
            detail="Refresh token has expired"
        )


    # Find user

    user = db.query(
        models.User
    ).filter(
        models.User.username ==
        refresh_token.username
    ).first()


    if not user:

        raise HTTPException(
            status_code=401,
            detail="User no longer exists"
        )


    # ========================================================
    # ROTATE REFRESH TOKEN
    # ========================================================

    refresh_token.revoked = True

    new_access_token = create_access_token(
        username=user.username,
        role=user.role
    )

    new_refresh_token = create_refresh_token(
        username=user.username,
        db=db
    )

    db.commit()


    return {

        "access_token": new_access_token,

        "refresh_token": new_refresh_token,

        "token_type": "bearer"
    }


# ============================================================
# LOGOUT
# ============================================================

@app.post("/logout")
def logout(
    request: schemas.RefreshRequest,
    db: Session = Depends(get_db)
):

    refresh_token = db.query(
        models.RefreshToken
    ).filter(
        models.RefreshToken.token ==
        request.refresh_token
    ).first()


    if not refresh_token:

        raise HTTPException(
            status_code=404,
            detail="Refresh token not found"
        )


    refresh_token.revoked = True

    db.commit()


    return {
        "message": "Successfully logged out"
    }


# ============================================================
# PROTECTED ROUTE
# ============================================================

@app.get("/protected")
def protected_route(
    current_user: models.User =
    Depends(get_current_user)
):

    return {

        "message":
        f"Hello {current_user.username}, "
        f"you have access to this protected route.",

        "username": current_user.username,

        "role": current_user.role
    }


# ============================================================
# ADMIN ONLY ROUTE
# ============================================================

@app.get("/admin")
def admin_route(
    current_user: models.User =
    Depends(get_current_user)
):

    if current_user.role != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )


    return {

        "message":
        f"Hello {current_user.username}, "
        "you have admin access."
    }
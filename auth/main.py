from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models
import schemas
import utils
from auth_database import get_db
from jose import jwt
from datetime import datetime, timedelta

SECRETE_KEY = "LbvOYD_ebJlqmfk3TtIZmQFJdeH_2UrN_rO7KrnlHlE"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Helper function that takes user_data
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update('exp': expire)
    encode_jwt = jwt.encode(to_encode, SECRETE_KEY, algorithm=ALGORITHM)
    return encode_jwt


app = FastAPI()

@app.post("/signup")
def signup(user: schemas.userCreate, db: Session=Depends(get_db)):
    # check the user exist or not
    existing_user = db.query(models.User).filter(models.User.username==user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username Already Exist")

    # Hash The Password
    hashed_pass = utils.hash_password(user.password)

    # create new user instance
    new_user = models.User(
        username = user.username,
        email = user.email,
        hashed_password = hashed_pass,
        role = user.role
    )

    # Save user to DB
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Return the value (excluding password)

    return {'id': new_user.id, "username": new_user.username, "email": new_user.email, "role": new_user.role}
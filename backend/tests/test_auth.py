import pytest
import uuid
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.postgres.models import User, EmailVerificationToken
from app.core.security import verify_password, create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_registration_and_hash_and_default_role(db_session):
    unique_email = f"auth_test_{uuid.uuid4().hex[:8]}@synchain.ai"
    raw_password = "SecurePassword123!"
    payload = {
        "name": "Jane Logistics",
        "email": unique_email,
        "password": raw_password
    }
    
    # 1. New user registration
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email"] == unique_email.lower()
    assert data["name"] == "Jane Logistics"
    assert data["role"] == "user"
    assert data["is_active"] is True
    assert "id" in data

    # 2. Verify password stored as hash, never plaintext
    user_in_db = db_session.query(User).filter(User.email == unique_email.lower()).first()
    assert user_in_db is not None
    assert user_in_db.password_hash != raw_password
    assert user_in_db.password_hash.startswith("$argon2") or user_in_db.password_hash.startswith("$2")
    assert verify_password(raw_password, user_in_db.password_hash) is True
    assert user_in_db.role == "user"

    # 3. Verify verification token record was created
    token_record = db_session.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user_in_db.id).first()
    assert token_record is not None


def test_duplicate_email_rejected():
    unique_email = f"dup_test_{uuid.uuid4().hex[:8]}@synchain.ai"
    payload = {
        "name": "First User",
        "email": unique_email,
        "password": "Password123!"
    }
    # First registration
    resp1 = client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 200

    # Duplicate registration
    resp2 = client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"]


def test_invalid_registration_input():
    # Short password (< 8 chars)
    resp_short = client.post("/api/v1/auth/register", json={
        "name": "Test Short",
        "email": "valid@synchain.ai",
        "password": "short"
    })
    assert resp_short.status_code == 422

    # Invalid email format
    resp_bad_email = client.post("/api/v1/auth/register", json={
        "name": "Test Bad Email",
        "email": "not-an-email",
        "password": "ValidPassword123!"
    })
    assert resp_bad_email.status_code == 422


def test_newly_registered_user_login():
    unique_email = f"login_test_{uuid.uuid4().hex[:8]}@synchain.ai"
    raw_password = "CorrectPassword123!"
    
    # Register
    reg_resp = client.post("/api/v1/auth/register", json={
        "name": "Login Tester",
        "email": unique_email,
        "password": raw_password
    })
    assert reg_resp.status_code == 200

    # Login with JSON
    login_resp = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": raw_password
    })
    assert login_resp.status_code == 200, login_resp.text
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # Also test case insensitivity and whitespace trimming
    login_resp_case = client.post("/api/v1/auth/login", json={
        "email": f"  {unique_email.upper()}  ",
        "password": raw_password
    })
    assert login_resp_case.status_code == 200


def test_oauth2_form_login_compatibility():
    unique_email = f"form_test_{uuid.uuid4().hex[:8]}@synchain.ai"
    raw_password = "FormPassword123!"
    
    # Register
    reg_resp = client.post("/api/v1/auth/register", json={
        "name": "Form Tester",
        "email": unique_email,
        "password": raw_password
    })
    assert reg_resp.status_code == 200

    # Login using form data (as Swagger UI sends)
    form_resp = client.post(
        "/api/v1/auth/login",
        data={"username": unique_email, "password": raw_password},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert form_resp.status_code == 200, form_resp.text
    assert "access_token" in form_resp.json()


def test_login_invalid_password():
    unique_email = f"inv_pw_{uuid.uuid4().hex[:8]}@synchain.ai"
    client.post("/api/v1/auth/register", json={
        "name": "User",
        "email": unique_email,
        "password": "GoodPassword123!"
    })

    # Wrong password
    resp = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword456!"
    })
    assert resp.status_code == 401
    assert "Incorrect email or password" in resp.json()["detail"]


def test_login_nonexistent_user():
    resp = client.post("/api/v1/auth/login", json={
        "email": "nonexistent_random_user_99@synchain.ai",
        "password": "AnyPassword123!"
    })
    assert resp.status_code == 401
    assert "Incorrect email or password" in resp.json()["detail"]


def test_authenticated_access_with_valid_token():
    unique_email = f"me_test_{uuid.uuid4().hex[:8]}@synchain.ai"
    raw_password = "MePassword123!"
    client.post("/api/v1/auth/register", json={
        "name": "Me Tester",
        "email": unique_email,
        "password": raw_password
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "email": unique_email,
        "password": raw_password
    })
    token = login_resp.json()["access_token"]

    # Access /auth/me
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert user_data["email"] == unique_email.lower()
    assert user_data["name"] == "Me Tester"


def test_authenticated_access_with_invalid_token():
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert resp.status_code == 401


def test_authenticated_access_with_expired_token():
    # Generate token that is already expired
    expired_token = create_access_token(subject=str(uuid.uuid4()), expires_delta=timedelta(seconds=-10))
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401

import sys
import traceback
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

try:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "testclient@synchain.ai", "password": "password123"}
    )
    print("Status:", response.status_code)
    print("Body:", response.json())
except Exception as e:
    print("Exception occurred!")
    traceback.print_exc()

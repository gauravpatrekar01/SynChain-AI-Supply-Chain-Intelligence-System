import requests

# Register a test user
reg_res = requests.post("http://localhost:8000/api/v1/auth/register", json={
    "name": "Test User 2",
    "email": "test_integ2@example.com",
    "password": "password123"
})
print("Reg:", reg_res.text)

# Login
login_res = requests.post("http://localhost:8000/api/v1/auth/login", json={
    "email": "test_integ2@example.com",
    "password": "password123"
})
token = login_res.json().get("access_token")

response = requests.post(
    "http://localhost:8000/api/v1/integrations",
    json={
        "name": "Test",
        "system_type": "ERPNext",
        "base_url": "http://localhost:8080",
        "auth_type": "api_key",
        "api_key": "test",
        "api_secret": "test"
    },
    headers={"Authorization": f"Bearer {token}"}
)
print("Create Status:", response.status_code)
print("Create Body:", response.text)


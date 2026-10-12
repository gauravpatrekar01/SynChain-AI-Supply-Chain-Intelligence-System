from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/synchain"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_DATABASE: str = "neo4j"
    MODEL_PATH: str = "./ml/models"
    API_KEYS: str = "default_sec_api_key_synchain_2026"
    AI_PROVIDER_KEY: str = ""
    JWT_SECRET: str = "synchain_jwt_secret_token_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    INTEGRATION_ENCRYPTION_KEY: str = ""
    
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "SynChain AI"
    
    FRONTEND_URL: str = "http://localhost:5173"

    # External Integrations
    WEATHER_API_KEY: str = ""
    NEWS_API_KEY: str = ""
    ERPNEXT_URL: str = ""
    ERPNEXT_API_KEY: str = ""
    ERPNEXT_API_SECRET: str = ""
    AWS_ENDPOINT_URL_S3: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-2"

    # Cloudinary Cloud Storage
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: str = ""

    HEALTH_CHECK_INTERVAL_SECONDS: int = 900

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"
        extra = "allow"


# SynChain core configuration singleton
settings = Settings()

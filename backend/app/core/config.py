from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/synchain"
    MONGODB_URL: str = ""
    MONGODB_DB_NAME: str = "synchain_db"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_DATABASE: str = "neo4j"
    MODEL_PATH: str = "./ml/models"
    API_KEYS: str = "default_sec_api_key_synchain_2026"
    AI_PROVIDER_KEY: str = ""
    # Server-side only. Numbered keys are compatible with the supplied Gemini pool.
    GEMINI_API_KEY: SecretStr = SecretStr("")
    GEMINI_API_KEYS: SecretStr = SecretStr("")  # comma-separated optional alternative
    GEMINI_API_KEY_1: SecretStr = SecretStr("")
    GEMINI_API_KEY_2: SecretStr = SecretStr("")
    GEMINI_API_KEY_3: SecretStr = SecretStr("")
    GEMINI_API_KEY_4: SecretStr = SecretStr("")
    GEMINI_API_KEY_5: SecretStr = SecretStr("")
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_REPORT_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: float = Field(default=15, ge=1, le=60)
    GEMINI_REQUEST_DEADLINE_SECONDS: float = Field(default=35, ge=1, le=120)
    GEMINI_MAX_ATTEMPTS: int = Field(default=3, ge=1, le=5)
    GEMINI_COOLDOWN_SECONDS: float = Field(default=60, ge=1, le=3600)
    GEMINI_MAX_CONCURRENT_REQUESTS: int = Field(default=4, ge=1, le=20)
    GEMINI_REQUESTS_PER_MINUTE: int = Field(default=15, ge=1, le=10000)
    GEMINI_MAX_OUTPUT_TOKENS: int = Field(default=4096, ge=256, le=8192)
    JWT_SECRET: str = "synchain_jwt_secret_token_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    INTEGRATION_ENCRYPTION_KEY: str = ""
    
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_USER: str = ""  # compatibility with supplied email service
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "SynChain AI"
    SMTP_TIMEOUT_SECONDS: float = Field(default=10.0, ge=1, le=60)
    SMTP_MAX_ATTEMPTS: int = Field(default=3, ge=1, le=5)
    SMTP_RETRY_DELAY_SECONDS: float = Field(default=0.5, ge=0, le=10)
    
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

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        extra="allow",
    )


# SynChain core configuration singleton
settings = Settings()

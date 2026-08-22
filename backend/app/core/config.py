import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/synchain"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    MODEL_PATH: str = "./ml/models"
    API_KEYS: str = "default_sec_api_key_synchain_2026"
    AI_PROVIDER_KEY: str = ""
    JWT_SECRET: str = "synchain_jwt_secret_token_change_in_production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

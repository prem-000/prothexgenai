from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional
from pathlib import Path
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

# Robustly determine the path to the .env file
# config.py is in app/config.py, so .env is in the parent directory of app/ (project root)
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):
    MONGO_URI: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GEMINI_API_KEY: str
    
    PROJECT_NAME: str = "Prosthetic Gait Analysis API"
    VERSION: str = "1.0.0"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

@lru_cache()
def get_settings():
    try:
        settings = Settings()
        logger.info(f"[OK] Settings loaded successfully from {ENV_FILE_PATH}")
        return settings
    except Exception as e:
        logger.error(f"[ERROR] Failed to load settings from {ENV_FILE_PATH}: {e}")
        raise e

settings = get_settings()

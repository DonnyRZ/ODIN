from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(ENV_PATH)

CreativityMode = Literal["user", "ai", "blend"]


class Settings(BaseSettings):
  model_config = SettingsConfigDict(env_file=ENV_PATH, env_file_encoding="utf-8", extra="ignore")

  genai_api_key: str = Field(..., env="GENAI_API_KEY")
  genai_model: str = Field("gemini-3-pro-preview", env="GENAI_MODEL")
  image_ai_key: str = Field(..., env="IMAGE_AI_KEY")
  image_model: str = Field("gemini-3-pro-image-preview", env="IMAGE_GEN")
  creativity_default: float = Field(0.5, ge=0.0, le=1.0)
  max_variants: int = Field(3, ge=1, le=6)
  frontend_base_url: str = Field("http://localhost:3000", env="FRONTEND_BASE_URL")
  cors_allowed_origins: str = Field(
    "http://localhost:3000,http://127.0.0.1:3000",
    env="CORS_ALLOWED_ORIGINS",
  )
  smtp_host: str = Field("", env="SMTP_HOST")
  smtp_port: int = Field(587, env="SMTP_PORT")
  smtp_user: str = Field("", env="SMTP_USER")
  smtp_password: str = Field("", env="SMTP_PASSWORD")
  smtp_from: str = Field("", env="SMTP_FROM")
  smtp_use_tls: bool = Field(False, env="SMTP_USE_TLS")
  smtp_use_starttls: bool = Field(True, env="SMTP_USE_STARTTLS")
  reset_token_hours: int = Field(2, ge=1, le=24, env="RESET_TOKEN_HOURS")
  auth_rate_limit_per_minute: int = Field(20, ge=1, le=120, env="AUTH_RATE_LIMIT_PER_MINUTE")
  allow_unauthenticated_generate: bool = Field(
    False,
    env="ALLOW_UNAUTHENTICATED_GENERATE",
  )
  midtrans_env: str = Field("sandbox", env="MIDTRANS_ENV")
  midtrans_is_production: bool = Field(False, env="MIDTRANS_IS_PRODUCTION")
  midtrans_server_key: str = Field("", env="MIDTRANS_SERVER_KEY")
  midtrans_client_key: str = Field("", env="MIDTRANS_CLIENT_KEY")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  return Settings()

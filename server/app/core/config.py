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
  google_client_id: str = Field("", env="GOOGLE_CLIENT_ID")
  google_client_secret: str = Field("", env="GOOGLE_CLIENT_SECRET")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  return Settings()

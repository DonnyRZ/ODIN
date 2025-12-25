from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
  project_name: str = Field(..., max_length=120)
  owner_id: Optional[str] = Field(None, description="Client owner/device identifier")
  prompt: Optional[str] = Field(None, description="Slide text or bullet points")
  slide_context: Optional[str] = Field(None, description="Extracted text or notes from the slide")
  slide_image_base64: Optional[str] = Field(None, description="Full slide screenshot encoded as base64 data URL")
  variant_count: int = Field(default=3, ge=1, le=5)
  creativity: float = Field(0.7, ge=0.0, le=1.0)
  aspect_ratio: str = Field("square", pattern="^(square|portrait_9x16|landscape_16x9)$")


class GeneratedResult(BaseModel):
  id: str
  image_base64: str
  description: str
  created_at: datetime


class GenerateResponse(BaseModel):
  results: List[GeneratedResult]


class HealthResponse(BaseModel):
  status: str = "ok"
  service: str = "odin-server"

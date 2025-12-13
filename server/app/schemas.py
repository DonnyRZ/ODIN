from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Selection(BaseModel):
  x: float = Field(..., ge=0)
  y: float = Field(..., ge=0)
  width: float = Field(..., gt=0)
  height: float = Field(..., gt=0)


class GenerateRequest(BaseModel):
  project_name: str = Field(..., max_length=120)
  prompt: Optional[str] = Field(None, description="Slide text or bullet points")
  selection: Selection
  variant_count: int = Field(default=3, ge=1, le=6)


class GeneratedResult(BaseModel):
  id: str
  image_url: str
  description: str
  created_at: datetime


class GenerateResponse(BaseModel):
  results: List[GeneratedResult]


class HealthResponse(BaseModel):
  status: str = "ok"
  service: str = "odin-server"

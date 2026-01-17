from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
  project_name: str = Field(..., max_length=120)
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


class PlanItem(BaseModel):
  id: str
  name: str
  price_idr: int
  summary: str
  features: List[str]


class PaymentTokenRequest(BaseModel):
  plan_id: str = Field(..., min_length=1)
  name: str = Field(..., min_length=2)
  email: str = Field(..., min_length=3)
  phone: str = Field(..., min_length=6)
  company: Optional[str] = Field(None, max_length=120)
  idempotency_key: str = Field(..., min_length=8, max_length=120)


class PaymentTokenResponse(BaseModel):
  order_id: str
  token: str
  redirect_url: Optional[str] = None


class PaymentStatusResponse(BaseModel):
  order_id: str
  status: str
  transaction_status: Optional[str] = None
  fraud_status: Optional[str] = None
  status_code: Optional[str] = None
  gross_amount: Optional[int] = None
  currency: Optional[str] = None
  paid_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None


class SubscriptionStatusResponse(BaseModel):
  user_id: str
  plan_id: str
  status: str
  order_id: Optional[str] = None
  started_at: Optional[datetime] = None
  current_period_end: Optional[datetime] = None
  created_at: Optional[datetime] = None
  updated_at: Optional[datetime] = None

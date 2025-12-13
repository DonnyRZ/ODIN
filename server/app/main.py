from datetime import datetime
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import GenerateRequest, GenerateResponse, GeneratedResult, HealthResponse


def _allowed_origins() -> list[str]:
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://odin.local",
    "*",
  ]


app = FastAPI(
  title="ODIN Workspace API",
  version="0.1.0",
  description="Service that orchestrates LLM + image generation for the ODIN workspace.",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=_allowed_origins(),
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
  return HealthResponse()


@app.post("/generate", response_model=GenerateResponse, tags=["generation"])
async def generate_visuals(payload: GenerateRequest) -> GenerateResponse:
  results = [
    GeneratedResult(
      id=str(uuid4()),
      image_url=f"https://placehold.co/600x600?text=Variant+{idx + 1}",
      description=f"Mock visual {idx + 1} for {payload.project_name}",
      created_at=datetime.utcnow(),
    )
    for idx in range(payload.variant_count)
  ]
  return GenerateResponse(results=results)

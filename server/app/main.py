from datetime import datetime
import base64
from uuid import uuid4

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import GenerateRequest, GenerateResponse, GeneratedResult, HealthResponse
from .services.genai_client import genai_client
from .services.rembg_client import remove_background


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

logger = logging.getLogger("odin")

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
  if not payload.prompt and not payload.slide_context:
    raise HTTPException(status_code=400, detail="Prompt or slide context required.")

  final_prompt = genai_client.enhance_prompt(
    user_prompt=payload.prompt or "",
    slide_context=payload.slide_context or "",
    creativity=payload.creativity,
  )
  logger.info("Enhanced prompt: %s", final_prompt)

  try:
    semi_images = genai_client.generate_images(
      prompt=final_prompt,
      aspect_ratio=payload.aspect_ratio,
      count=payload.variant_count,
    )
  except Exception as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc

  results = []
  for raw_image in semi_images:
    transparent = remove_background(raw_image)
    encoded = base64.b64encode(transparent).decode("ascii")
    results.append(
      GeneratedResult(
        id=str(uuid4()),
        image_base64=encoded,
        description=final_prompt,
        created_at=datetime.utcnow(),
      )
    )

  return GenerateResponse(results=results)

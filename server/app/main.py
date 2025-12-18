from datetime import datetime
import base64
from uuid import uuid4

import logging
from time import perf_counter

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
logger.setLevel(logging.INFO)

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

  if not payload.slide_image_base64:
    raise HTTPException(status_code=400, detail="Slide image is required.")

  try:
    prompt_start = perf_counter()
    final_prompt = genai_client.enhance_prompt(
      user_prompt=payload.prompt or "",
      slide_context=payload.slide_context or "",
      creativity=payload.creativity,
      slide_image_base64=payload.slide_image_base64,
    )
    logger.info("Prompt enhancement took %.2fs", perf_counter() - prompt_start)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  logger.info("Original prompt: %s", payload.prompt)
  logger.info("Enhanced prompt: %s", final_prompt)

  try:
    image_start = perf_counter()
    semi_images = genai_client.generate_images(
      prompt=final_prompt,
      aspect_ratio=payload.aspect_ratio,
      count=payload.variant_count,
    )
    logger.info(
      "Image generation took %.2fs for %s variants",
      perf_counter() - image_start,
      payload.variant_count,
    )
  except Exception as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc

  results = []
  for idx, raw_image in enumerate(semi_images, start=1):
    rembg_start = perf_counter()
    transparent = remove_background(raw_image)
    logger.info("Background removal for image %s took %.2fs", idx, perf_counter() - rembg_start)
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

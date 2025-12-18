import base64
import json
from datetime import datetime
from uuid import uuid4

import logging
from time import perf_counter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .schemas import GenerateRequest, HealthResponse
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


def _sse_event(event: str, payload: dict) -> bytes:
  data = json.dumps(payload, default=str)
  return f"event: {event}\ndata: {data}\n\n".encode("utf-8")

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


@app.post("/generate", tags=["generation"])
async def generate_visuals(payload: GenerateRequest):
  if not payload.prompt and not payload.slide_context:
    raise HTTPException(status_code=400, detail="Prompt or slide context required.")

  if not payload.slide_image_base64:
    raise HTTPException(status_code=400, detail="Slide image is required.")

  async def event_stream():
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
      logger.exception("Prompt enhancement failed")
      yield _sse_event("error", {"message": str(exc)})
      return

    logger.info("Original prompt: %s", payload.prompt)
    logger.info("Enhanced prompt: %s", final_prompt)

    for idx in range(1, payload.variant_count + 1):
      try:
        image_start = perf_counter()
        semi_images = genai_client.generate_images(
          prompt=final_prompt,
          aspect_ratio=payload.aspect_ratio,
          count=1,
        )
        logger.info(
          "Image generation took %.2fs for image %s",
          perf_counter() - image_start,
          idx,
        )
        raw_image = semi_images[0]
      except Exception as exc:
        logger.exception("Image generation failed")
        yield _sse_event("error", {"message": str(exc)})
        return

      rembg_start = perf_counter()
      try:
        transparent = remove_background(raw_image)
      except Exception as exc:
        logger.exception("Background removal failed")
        yield _sse_event("error", {"message": str(exc)})
        return
      logger.info("Background removal for image %s took %.2fs", idx, perf_counter() - rembg_start)
      encoded = base64.b64encode(transparent).decode("ascii")
      result_payload = {
        "id": str(uuid4()),
        "image_base64": encoded,
        "description": final_prompt,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "index": idx,
      }
      yield _sse_event("result", result_payload)

    yield _sse_event("done", {"count": payload.variant_count})

  return StreamingResponse(event_stream(), media_type="text/event-stream")

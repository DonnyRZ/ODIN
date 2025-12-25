import base64
import json
from datetime import datetime, timedelta
from uuid import uuid4

import logging
import sqlite3
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .core.auth import hash_password, verify_google_token, verify_password
from .core.db import (
  DATA_DIR,
  create_user_with_password,
  create_session,
  db_connection,
  get_user_by_username,
  get_or_create_user,
  get_generation_image_path,
  get_or_create_project,
  get_project,
  get_user_id_for_token,
  init_db,
  insert_generation,
  list_generation_image_paths,
  list_generations,
  list_projects,
  delete_project,
  update_project_name,
  save_generated_image,
)
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


def _resolve_owner_id(request: Request, fallback: str) -> str:
  auth_header = request.headers.get("Authorization", "")
  if auth_header.startswith("Bearer "):
    token = auth_header.replace("Bearer ", "").strip()
    now = datetime.utcnow().isoformat() + "Z"
    with db_connection() as conn:
      user_id = get_user_id_for_token(conn, token, now)
    if user_id:
      return user_id
  return fallback

app.add_middleware(
  CORSMiddleware,
  allow_origins=_allowed_origins(),
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.on_event("startup")
def startup():
  init_db()


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
  return HealthResponse()


@app.get("/projects", tags=["projects"])
async def list_projects_handler(request: Request, owner_id: str = "local"):
  resolved_owner = _resolve_owner_id(request, owner_id)
  with db_connection() as conn:
    projects = list_projects(conn, resolved_owner)
  return {"projects": projects}


@app.post("/projects", tags=["projects"])
async def create_project_handler(request: Request, payload: dict):
  owner_id = _resolve_owner_id(request, payload.get("owner_id") or "local")
  name = payload.get("name") or "Untitled project"
  timestamp = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    project_id = get_or_create_project(
      conn,
      owner_id=owner_id,
      name=name,
      updated_at=timestamp,
      prompt=payload.get("prompt") or "",
      slide_context=payload.get("slide_context") or "",
    )
  return {"id": project_id}


@app.patch("/projects/{project_id}", tags=["projects"])
async def update_project_handler(request: Request, project_id: str, payload: dict):
  owner_id = _resolve_owner_id(request, payload.get("owner_id") or "local")
  name = payload.get("name")
  if not name:
    raise HTTPException(status_code=400, detail="Project name required.")
  timestamp = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    try:
      updated = update_project_name(
        conn,
        owner_id=owner_id,
        project_id=project_id,
        name=name,
        updated_at=timestamp,
        prompt=payload.get("prompt") or "",
        slide_context=payload.get("slide_context") or "",
      )
    except sqlite3.IntegrityError as exc:
      raise HTTPException(status_code=409, detail="Project name already exists.") from exc
  if not updated:
    raise HTTPException(status_code=404, detail="Project not found.")
  return {"id": project_id, "name": name, "updated_at": timestamp}


@app.get("/projects/{project_id}", tags=["projects"])
async def get_project_handler(request: Request, project_id: str, owner_id: str = "local"):
  resolved_owner = _resolve_owner_id(request, owner_id)
  with db_connection() as conn:
    project = get_project(conn, resolved_owner, project_id)
    if not project:
      raise HTTPException(status_code=404, detail="Project not found.")
    generations = list_generations(conn, project_id)
  return {"project": project, "generations": generations}


@app.delete("/projects/{project_id}", tags=["projects"])
async def delete_project_handler(request: Request, project_id: str, owner_id: str = "local"):
  resolved_owner = _resolve_owner_id(request, owner_id)
  with db_connection() as conn:
    image_paths = list_generation_image_paths(conn, project_id)
    deleted = delete_project(conn, resolved_owner, project_id)
  if not deleted:
    raise HTTPException(status_code=404, detail="Project not found.")
  for image_path in image_paths:
    full_path = (DATA_DIR / image_path).resolve()
    if DATA_DIR in full_path.parents and full_path.exists():
      try:
        full_path.unlink()
      except OSError:
        logger.warning("Failed to delete image file: %s", full_path)
  return {"id": project_id}


@app.get("/generations/{generation_id}/image", tags=["generations"])
async def get_generation_image(request: Request, generation_id: str):
  _ = _resolve_owner_id(request, "local")
  with db_connection() as conn:
    image_path = get_generation_image_path(conn, generation_id)
  if not image_path:
    raise HTTPException(status_code=404, detail="Image not found.")
  full_path = (DATA_DIR / image_path).resolve()
  if not full_path.exists():
    raise HTTPException(status_code=404, detail="Image file missing.")
  return FileResponse(full_path, media_type="image/png")


@app.post("/generate", tags=["generation"])
async def generate_visuals(request: Request, payload: GenerateRequest):
  if not payload.prompt and not payload.slide_context:
    raise HTTPException(status_code=400, detail="Prompt or slide context required.")

  if not payload.slide_image_base64:
    raise HTTPException(status_code=400, detail="Slide image is required.")

  async def event_stream():
    with db_connection() as conn:
      updated_at = datetime.utcnow().isoformat() + "Z"
      owner_id = _resolve_owner_id(request, payload.owner_id or "local")
      project_id = get_or_create_project(
        conn,
        owner_id=owner_id,
        name=payload.project_name,
        updated_at=updated_at,
        prompt=payload.prompt or "",
        slide_context=payload.slide_context or "",
      )

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
        generation_id = str(uuid4())
        image_path = save_generated_image(transparent, generation_id)
        created_at = datetime.utcnow().isoformat() + "Z"
        insert_generation(
          conn,
          generation_id=generation_id,
          project_id=project_id,
          image_path=image_path,
          description=final_prompt,
          aspect_ratio=payload.aspect_ratio,
          created_at=created_at,
        )
        conn.commit()
        result_payload = {
          "id": generation_id,
          "image_base64": encoded,
          "description": final_prompt,
          "created_at": created_at,
          "index": idx,
        }
        yield _sse_event("result", result_payload)

      yield _sse_event("done", {"count": payload.variant_count})

  return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/auth/google", tags=["auth"])
async def google_auth(payload: dict):
  token = payload.get("id_token")
  if not token:
    raise HTTPException(status_code=400, detail="id_token required.")
  user = verify_google_token(token)
  if not user:
    raise HTTPException(status_code=401, detail="Invalid token.")

  created_at = datetime.utcnow().isoformat() + "Z"
  expires_at = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
  with db_connection() as conn:
    user_id = get_or_create_user(
      conn,
      google_sub=user.sub,
      email=user.email,
      name=user.name,
      created_at=created_at,
    )
    session_token = create_session(conn, user_id=user_id, created_at=created_at, expires_at=expires_at)
  return {"token": session_token, "user_id": user_id, "email": user.email, "name": user.name}


@app.post("/auth/register", tags=["auth"])
async def register_user(payload: dict):
  username = (payload.get("username") or "").strip()
  password = payload.get("password") or ""
  if len(username) < 3:
    raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
  if len(password) < 8:
    raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

  created_at = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    if get_user_by_username(conn, username):
      raise HTTPException(status_code=409, detail="Username already exists.")
    password_hash = hash_password(password)
    user_id = create_user_with_password(
      conn,
      username=username,
      password_hash=password_hash,
      created_at=created_at,
    )
    session_token = create_session(
      conn,
      user_id=user_id,
      created_at=created_at,
      expires_at=(datetime.utcnow() + timedelta(days=7)).isoformat() + "Z",
    )
  return {"token": session_token, "user_id": user_id, "username": username}


@app.post("/auth/login", tags=["auth"])
async def login_user(payload: dict):
  username = (payload.get("username") or "").strip()
  password = payload.get("password") or ""
  if not username or not password:
    raise HTTPException(status_code=400, detail="Username and password required.")
  now = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    user = get_user_by_username(conn, username)
    if not user or not user.get("password_hash"):
      raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not verify_password(password, user["password_hash"]):
      raise HTTPException(status_code=401, detail="Invalid credentials.")
    session_token = create_session(
      conn,
      user_id=user["id"],
      created_at=now,
      expires_at=(datetime.utcnow() + timedelta(days=7)).isoformat() + "Z",
    )
  return {"token": session_token, "user_id": user["id"], "username": username}

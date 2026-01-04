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

from .core.auth import hash_password, verify_password
from .core.config import get_settings
from .core.db import (
  DATA_DIR,
  create_user_with_password,
  create_session,
  create_password_reset_token,
  db_connection,
  get_generation_image_path_for_user,
  get_user_by_email,
  get_user_by_username,
  get_or_create_project,
  get_project,
  get_project_slide_image_path,
  get_user_id_for_token,
  init_db,
  insert_generation,
  list_generation_image_paths,
  list_generations,
  list_projects,
  delete_project,
  consume_password_reset_token,
  update_user_password,
  update_project_name,
  save_generated_image,
  save_slide_image,
  update_project_slide_image,
)
from .schemas import GenerateRequest, HealthResponse
from .services.email_client import send_email
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


def _require_user_id(request: Request) -> str:
  auth_header = request.headers.get("Authorization", "")
  if not auth_header.startswith("Bearer "):
    raise HTTPException(status_code=401, detail="Authorization required.")
  token = auth_header.replace("Bearer ", "").strip()
  now = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    user_id = get_user_id_for_token(conn, token, now)
  if not user_id:
    raise HTTPException(status_code=401, detail="Invalid or expired session.")
  return user_id


def _send_welcome_email(email: str, username: str) -> None:
  body = (
    f"Welcome to ODIN, {username}.\n\n"
    "We're excited to have you on board. Your workspace is ready.\n"
    "If you did not create this account, you can ignore this email."
  )
  send_email(email, "Welcome to ODIN", body)


def _send_reset_email(email: str, token: str) -> None:
  settings = get_settings()
  reset_url = f"{settings.frontend_base_url}/reset?token={token}"
  body = (
    "We received a request to reset your ODIN password.\n\n"
    "Set a new password here:\n"
    f"{reset_url}\n\n"
    "If you did not request a reset, you can ignore this email."
  )
  send_email(email, "Reset your ODIN password", body)


def _normalize_email(email: str) -> str:
  return email.strip().lower()


def _is_valid_email(email: str) -> bool:
  if "@" not in email:
    return False
  domain = email.split("@")[-1]
  return "." in domain


def _decode_image_data(data_url: str) -> bytes:
  if not data_url:
    raise ValueError("Slide image missing.")
  if data_url.startswith("data:"):
    _, b64data = data_url.split(",", 1)
  else:
    b64data = data_url
  try:
    return base64.b64decode(b64data)
  except Exception as exc:
    raise ValueError("Invalid slide image data.") from exc

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
async def list_projects_handler(request: Request):
  owner_id = _require_user_id(request)
  with db_connection() as conn:
    projects = list_projects(conn, owner_id)
  return {"projects": projects}


@app.post("/projects", tags=["projects"])
async def create_project_handler(request: Request, payload: dict):
  owner_id = _require_user_id(request)
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
  owner_id = _require_user_id(request)
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
async def get_project_handler(request: Request, project_id: str):
  resolved_owner = _require_user_id(request)
  with db_connection() as conn:
    project = get_project(conn, resolved_owner, project_id)
    if not project:
      raise HTTPException(status_code=404, detail="Project not found.")
    generations = list_generations(conn, project_id)
  return {"project": project, "generations": generations}


@app.post("/projects/{project_id}/slide-image", tags=["projects"])
async def upload_project_slide_image(request: Request, project_id: str, payload: dict):
  owner_id = _require_user_id(request)
  image_data = payload.get("slide_image_base64") or ""
  try:
    image_bytes = _decode_image_data(image_data)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  image_path = save_slide_image(image_bytes, project_id)
  updated_at = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    updated = update_project_slide_image(
      conn,
      owner_id=owner_id,
      project_id=project_id,
      slide_image_path=image_path,
      updated_at=updated_at,
    )
  if not updated:
    raise HTTPException(status_code=404, detail="Project not found.")
  return {"slide_image_path": image_path, "updated_at": updated_at}


@app.get("/projects/{project_id}/slide-image", tags=["projects"])
async def get_project_slide_image(request: Request, project_id: str):
  owner_id = _require_user_id(request)
  with db_connection() as conn:
    image_path = get_project_slide_image_path(conn, owner_id=owner_id, project_id=project_id)
  if not image_path:
    raise HTTPException(status_code=404, detail="Slide image not found.")
  full_path = (DATA_DIR / image_path).resolve()
  if not full_path.exists():
    raise HTTPException(status_code=404, detail="Slide image file missing.")
  return FileResponse(full_path, media_type="image/png")


@app.delete("/projects/{project_id}/slide-image", tags=["projects"])
async def delete_project_slide_image(request: Request, project_id: str):
  owner_id = _require_user_id(request)
  with db_connection() as conn:
    image_path = get_project_slide_image_path(conn, owner_id=owner_id, project_id=project_id)
    updated = update_project_slide_image(
      conn,
      owner_id=owner_id,
      project_id=project_id,
      slide_image_path=None,
      updated_at=datetime.utcnow().isoformat() + "Z",
    )
  if not updated:
    raise HTTPException(status_code=404, detail="Project not found.")
  if image_path:
    full_path = (DATA_DIR / image_path).resolve()
    if DATA_DIR in full_path.parents and full_path.exists():
      try:
        full_path.unlink()
      except OSError:
        logger.warning("Failed to delete slide image file: %s", full_path)
  return {"id": project_id}


@app.delete("/projects/{project_id}", tags=["projects"])
async def delete_project_handler(request: Request, project_id: str):
  resolved_owner = _require_user_id(request)
  with db_connection() as conn:
    slide_image_path = get_project_slide_image_path(conn, owner_id=resolved_owner, project_id=project_id)
    image_paths = list_generation_image_paths(conn, project_id)
    deleted = delete_project(conn, resolved_owner, project_id)
  if not deleted:
    raise HTTPException(status_code=404, detail="Project not found.")
  if slide_image_path:
    full_path = (DATA_DIR / slide_image_path).resolve()
    if DATA_DIR in full_path.parents and full_path.exists():
      try:
        full_path.unlink()
      except OSError:
        logger.warning("Failed to delete slide image file: %s", full_path)
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
  owner_id = _require_user_id(request)
  with db_connection() as conn:
    image_path = get_generation_image_path_for_user(conn, generation_id=generation_id, owner_id=owner_id)
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

  owner_id = _require_user_id(request)

  async def event_stream():
    with db_connection() as conn:
      updated_at = datetime.utcnow().isoformat() + "Z"
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


@app.post("/auth/register", tags=["auth"])
async def register_user(payload: dict):
  email = _normalize_email(payload.get("email") or "")
  username = (payload.get("username") or "").strip()
  password = payload.get("password") or ""
  if not _is_valid_email(email):
    raise HTTPException(status_code=400, detail="Valid email required.")
  if len(username) < 3:
    raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
  if len(password) < 8:
    raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

  created_at = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    if get_user_by_email(conn, email):
      raise HTTPException(status_code=409, detail="Email already exists.")
    if get_user_by_username(conn, username):
      raise HTTPException(status_code=409, detail="Username already exists.")
    password_hash = hash_password(password)
    user_id = create_user_with_password(
      conn,
      email=email,
      username=username,
      password_hash=password_hash,
      name=username,
      created_at=created_at,
    )
  try:
    _send_welcome_email(email, username)
  except Exception as exc:
    logger.warning("Failed to send welcome email: %s", exc)
  return {"message": "Account created."}


@app.post("/auth/login", tags=["auth"])
async def login_user(payload: dict):
  email = _normalize_email(payload.get("email") or "")
  password = payload.get("password") or ""
  if not email or not password:
    raise HTTPException(status_code=400, detail="Email and password required.")
  now = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    user = get_user_by_email(conn, email)
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
  return {
    "token": session_token,
    "user_id": user["id"],
    "username": user["username"],
    "email": user["email"],
  }


@app.post("/auth/forgot-password", tags=["auth"])
async def forgot_password(payload: dict):
  email = _normalize_email(payload.get("email") or "")
  if not _is_valid_email(email):
    raise HTTPException(status_code=400, detail="Valid email required.")
  settings = get_settings()
  with db_connection() as conn:
    user = get_user_by_email(conn, email)
    if user and user.get("email_verified"):
      token = create_password_reset_token(
        conn,
        user_id=user["id"],
        created_at=datetime.utcnow().isoformat() + "Z",
        expires_at=(datetime.utcnow() + timedelta(hours=settings.reset_token_hours)).isoformat() + "Z",
      )
      try:
        _send_reset_email(email, token)
      except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
  return {"message": "If an account exists, a reset email has been sent."}


@app.post("/auth/reset-password", tags=["auth"])
async def reset_password(payload: dict):
  token = (payload.get("token") or "").strip()
  password = payload.get("password") or ""
  if not token:
    raise HTTPException(status_code=400, detail="Reset token required.")
  if len(password) < 8:
    raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
  now = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    user_id = consume_password_reset_token(conn, token=token, now=now)
    if not user_id:
      raise HTTPException(status_code=400, detail="Invalid or expired token.")
    password_hash = hash_password(password)
    update_user_password(conn, user_id, password_hash)
  return {"message": "Password updated."}

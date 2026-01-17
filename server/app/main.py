import base64
import hashlib
import json
from datetime import datetime, timedelta
from time import perf_counter, time
from uuid import uuid4

import logging
import sqlite3
import requests
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, FastAPI, HTTPException, Request
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
  create_subscription_period,
  claim_payment_order_for_token,
  get_generation_image_path_for_user,
  get_user_by_email,
  get_user_by_username,
  get_latest_payment_event,
  get_payment_order_by_idempotency_key,
  get_latest_active_subscription_period,
  get_or_create_project,
  get_project,
  get_project_slide_image_path,
  get_user_id_for_token,
  init_db,
  insert_generation,
  list_generation_image_paths,
  list_generations,
  list_subscription_periods_for_user,
  list_projects,
  delete_project,
  consume_password_reset_token,
  update_user_password,
  update_project_name,
  save_generated_image,
  save_slide_image,
  update_project_slide_image,
  create_payment_order,
  get_payment_order,
  get_subscription_period_by_order_id,
  update_payment_order_processing_status,
  update_payment_order_status,
  update_payment_order_token,
  update_subscription_period_status,
  get_subscription,
  upsert_subscription,
  insert_payment_event,
)
from .schemas import (
  GenerateRequest,
  HealthResponse,
  PlanItem,
  PaymentStatusResponse,
  PaymentTokenRequest,
  PaymentTokenResponse,
  SubscriptionStatusResponse,
)
from .plans import get_plan_catalog
from .services.email_client import send_email
from .services.genai_client import genai_client
from .services.rembg_client import remove_background


def _allowed_origins() -> list[str]:
  settings = get_settings()
  origins = [origin.strip() for origin in settings.cors_allowed_origins.split(",") if origin.strip()]
  return origins or ["http://localhost:3000"]


def _allowed_origin_regex(origins: list[str]) -> str | None:
  for origin in origins:
    if origin.startswith("chrome-extension://"):
      return r"^chrome-extension://.*$"
  return None


app = FastAPI(
  title="ODIN Workspace API",
  version="0.1.0",
  description="Service that orchestrates LLM + image generation for the ODIN workspace.",
)
router = APIRouter(prefix="/api")

logger = logging.getLogger("odin")
logger.setLevel(logging.INFO)

_auth_requests: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _rate_limit_auth(request: Request, action: str) -> None:
  settings = get_settings()
  limit = settings.auth_rate_limit_per_minute
  window_seconds = 60.0
  client_ip = request.client.host if request.client else "unknown"
  key = (client_ip, action)
  now = time()
  window = _auth_requests[key]
  while window and window[0] <= now - window_seconds:
    window.popleft()
  if len(window) >= limit:
    logger.warning("Rate limit hit for %s from %s", action, client_ip)
    raise HTTPException(status_code=429, detail="Too many requests. Please try again soon.")
  window.append(now)


def _sse_event(event: str, payload: dict) -> bytes:
  data = json.dumps(payload, default=str)
  return f"event: {event}\ndata: {data}\n\n".encode("utf-8")


def _require_user_id(request: Request) -> str:
  auth_header = request.headers.get("Authorization", "")
  if not auth_header.startswith("Bearer "):
    settings = get_settings()
    if settings.allow_unauthenticated_generate and request.url.path.endswith("/generate"):
      return "anonymous"
    raise HTTPException(status_code=401, detail="Authorization required.")
  token = auth_header.replace("Bearer ", "").strip()
  now = datetime.utcnow().isoformat() + "Z"
  with db_connection() as conn:
    user_id = get_user_id_for_token(conn, token, now)
  if not user_id:
    settings = get_settings()
    if settings.allow_unauthenticated_generate and request.url.path.endswith("/generate"):
      return "anonymous"
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


def _split_name(full_name: str) -> tuple[str, str]:
  parts = full_name.strip().split()
  if not parts:
    return "Customer", ""
  if len(parts) == 1:
    return parts[0], ""
  return parts[0], " ".join(parts[1:])


def _generate_order_id(plan_id: str) -> str:
  return f"ODIN-{plan_id.upper()}-{uuid4().hex}"


def _parse_amount(value: object) -> int:
  if value is None:
    return 0
  if isinstance(value, (int, float)):
    return int(value)
  text = str(value).strip()
  if not text:
    return 0
  try:
    return int(float(text))
  except ValueError:
    return 0


def _midtrans_is_production(settings) -> bool:
  env = (settings.midtrans_env or "").strip().lower()
  return settings.midtrans_is_production or env == "production"


def _midtrans_snap_base_url(settings) -> str:
  if _midtrans_is_production(settings):
    return "https://app.midtrans.com"
  return "https://app.sandbox.midtrans.com"


def _midtrans_api_base_url(settings) -> str:
  if _midtrans_is_production(settings):
    return "https://api.midtrans.com"
  return "https://api.sandbox.midtrans.com"


def _midtrans_auth_header(server_key: str) -> str:
  raw = f"{server_key}:".encode("ascii")
  return base64.b64encode(raw).decode("ascii")


def _fetch_midtrans_status(settings, order_id: str) -> tuple[str, Optional[dict]]:
  url = f"{_midtrans_api_base_url(settings)}/v2/{order_id}/status"
  headers = {
    "Accept": "application/json",
    "Authorization": f"Basic {_midtrans_auth_header(settings.midtrans_server_key)}",
  }
  try:
    response = requests.get(url, headers=headers, timeout=20)
  except requests.RequestException:
    return ("error", None)
  if response.status_code == 404:
    return ("not_found", None)
  if response.status_code != 200:
    return ("error", {"status_code": response.status_code, "body": response.text})
  try:
    return ("ok", response.json())
  except ValueError:
    return ("error", {"status_code": response.status_code, "body": response.text})


def _midtrans_signature(
  *,
  order_id: str,
  status_code: str,
  gross_amount: str,
  server_key: str,
) -> str:
  raw = f"{order_id}{status_code}{gross_amount}{server_key}".encode("utf-8")
  return hashlib.sha512(raw).hexdigest()


def _map_midtrans_status(transaction_status: str | None, fraud_status: str | None) -> str:
  if not transaction_status:
    return "UNKNOWN"
  if transaction_status in ("capture", "settlement"):
    if fraud_status == "challenge":
      return "PENDING"
    return "PAID"
  if transaction_status in ("pending", "authorize"):
    return "PENDING"
  if transaction_status in ("deny", "cancel", "expire"):
    return "FAILED"
  if transaction_status in ("refund", "partial_refund", "chargeback", "partial_chargeback"):
    return "REFUNDED"
  return "UNKNOWN"


def _map_subscription_status(payment_status: str) -> str:
  if payment_status == "PAID":
    return "active"
  if payment_status == "PENDING":
    return "pending"
  if payment_status in ("FAILED", "REFUNDED"):
    return "canceled"
  return "pending"


def _parse_iso_datetime(value: str | None) -> datetime | None:
  if not value:
    return None
  try:
    return datetime.fromisoformat(value.replace("Z", ""))
  except ValueError:
    return None


def _next_billing_period(current_period_end: str | None, now: datetime) -> tuple[str, str]:
  current_end = _parse_iso_datetime(current_period_end)
  if current_end and current_end > now:
    period_start = current_end
  else:
    period_start = now
  period_end = period_start + timedelta(days=30)
  return (
    period_start.isoformat() + "Z",
    period_end.isoformat() + "Z",
  )


def _select_subscription_snapshot(periods: list[dict], now: datetime) -> Optional[dict]:
  def period_end_dt(period: dict) -> datetime:
    parsed = _parse_iso_datetime(period.get("period_end"))
    return parsed if parsed else datetime.min

  active_candidates = [
    period
    for period in periods
    if period.get("status") == "active" and period_end_dt(period) > now
  ]
  if active_candidates:
    selected = max(active_candidates, key=period_end_dt)
    status = "active"
  else:
    if not periods:
      return None
    selected = max(periods, key=period_end_dt)
    status = "canceled"

  selected_end = period_end_dt(selected)
  if selected_end == datetime.min:
    current_period_end = None
  elif status == "active":
    current_period_end = selected_end
  else:
    current_period_end = min(selected_end, now)

  return {
    "status": status,
    "plan_id": selected.get("plan_id") or "unknown",
    "order_id": selected.get("order_id"),
    "started_at": selected.get("period_start"),
    "current_period_end": current_period_end.isoformat() + "Z" if current_period_end else None,
  }


def _refresh_subscription_snapshot(conn, user_id: str, now: datetime) -> None:
  periods = list_subscription_periods_for_user(conn, user_id=user_id)
  snapshot = _select_subscription_snapshot(periods, now)
  if not snapshot:
    return
  now_iso = now.isoformat() + "Z"
  upsert_subscription(
    conn,
    user_id=user_id,
    plan_id=snapshot["plan_id"],
    status=snapshot["status"],
    order_id=snapshot["order_id"],
    started_at=snapshot["started_at"],
    current_period_end=snapshot["current_period_end"],
    created_at=now_iso,
    updated_at=now_iso,
  )


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

_cors_origins = _allowed_origins()
app.add_middleware(
  CORSMiddleware,
  allow_origins=_cors_origins,
  allow_origin_regex=_allowed_origin_regex(_cors_origins),
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.on_event("startup")
def startup():
  init_db()


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
  return HealthResponse()


@router.get("/plans", response_model=list[PlanItem], tags=["billing"])
async def list_plans_handler() -> list[PlanItem]:
  return [PlanItem(**plan.__dict__) for plan in get_plan_catalog()]


@router.post("/payments/midtrans/token", response_model=PaymentTokenResponse, tags=["payments"])
async def create_midtrans_token(request: Request, payload: PaymentTokenRequest) -> PaymentTokenResponse:
  settings = get_settings()
  if not settings.midtrans_server_key or not settings.midtrans_client_key:
    raise HTTPException(status_code=500, detail="Midtrans keys are not configured.")
  user_id = _require_user_id(request)
  name = payload.name.strip()
  email = payload.email.strip()
  phone = payload.phone.strip()
  idempotency_key = payload.idempotency_key.strip()
  if not idempotency_key:
    raise HTTPException(status_code=400, detail="Idempotency key required.")
  if not name:
    raise HTTPException(status_code=400, detail="Name required.")
  if not _is_valid_email(email):
    raise HTTPException(status_code=400, detail="Valid email required.")
  if not phone:
    raise HTTPException(status_code=400, detail="Phone number required.")

  plan = next((plan for plan in get_plan_catalog() if plan.id == payload.plan_id), None)
  if not plan:
    raise HTTPException(status_code=400, detail="Plan not found.")

  now_dt = datetime.utcnow()
  now = now_dt.isoformat() + "Z"
  order_id = None
  customer_name = name
  customer_email = email
  customer_phone = phone
  status_check_order_id: Optional[str] = None
  status_check_existing: Optional[dict] = None
  processing_timeout_seconds = 120

  with db_connection() as conn:
    existing = get_payment_order_by_idempotency_key(
      conn,
      user_id=user_id,
      idempotency_key=idempotency_key,
    )
    if existing:
      order_id = str(existing["order_id"])
      if existing.get("plan_id") != plan.id:
        raise HTTPException(
          status_code=409,
          detail="Idempotency key already used for different plan.",
        )
      if existing.get("status") in ("PAID", "REFUNDED"):
        raise HTTPException(status_code=409, detail="Payment already completed.")
      existing_token = existing.get("snap_token")
      if existing_token:
        return PaymentTokenResponse(
          order_id=existing["order_id"],
          token=existing_token,
          redirect_url=None,
        )
      event = get_latest_payment_event(conn, order_id=order_id, event_type="token_success")
      if event:
        try:
          event_payload = json.loads(event.get("payload_json") or "{}")
        except ValueError:
          event_payload = {}
        recovered_token = event_payload.get("token")
        if recovered_token:
          updated = update_payment_order_token(
            conn,
            order_id=order_id,
            snap_token=recovered_token,
            updated_at=now,
            status="CREATED",
          )
          if updated:
            return PaymentTokenResponse(
              order_id=order_id,
              token=recovered_token,
              redirect_url=event_payload.get("redirect_url"),
            )
          latest = get_payment_order(conn, order_id)
          if latest and latest.get("snap_token"):
            return PaymentTokenResponse(
              order_id=order_id,
              token=latest["snap_token"],
              redirect_url=None,
            )
      if existing.get("status") == "FAILED":
        claimed = claim_payment_order_for_token(
          conn,
          order_id=order_id,
          allowed_statuses=("FAILED",),
          updated_at=now,
        )
        if not claimed:
          raise HTTPException(
            status_code=409,
            detail="Payment sedang diproses. Coba lagi sebentar.",
          )
        customer_name = str(existing.get("customer_name") or name)
        customer_email = str(existing.get("customer_email") or email)
        customer_phone = str(existing.get("customer_phone") or phone)
      else:
        updated_at = _parse_iso_datetime(existing.get("updated_at"))
        if updated_at and (now_dt - updated_at).total_seconds() > processing_timeout_seconds:
          status_check_order_id = order_id
          status_check_existing = existing
        else:
          raise HTTPException(
            status_code=409,
            detail="Payment sedang diproses. Coba lagi sebentar.",
          )
    else:
      order_id = _generate_order_id(plan.id)
      while get_payment_order(conn, order_id):
        order_id = _generate_order_id(plan.id)
      create_payment_order(
        conn,
        order_id=order_id,
        user_id=user_id,
        idempotency_key=idempotency_key,
        plan_id=plan.id,
        gross_amount=plan.price_idr,
        currency="IDR",
        customer_name=name,
        customer_email=email,
        customer_phone=phone,
        status="CREATING",
        created_at=now,
        updated_at=now,
      )

  if not order_id:
    raise HTTPException(status_code=500, detail="Failed to initialize payment order.")

  if status_check_order_id:
    status_state, status_payload = _fetch_midtrans_status(settings, status_check_order_id)
    now = datetime.utcnow().isoformat() + "Z"
    if status_state == "ok" and status_payload:
      transaction_status = status_payload.get("transaction_status")
      fraud_status = status_payload.get("fraud_status")
      status_code = status_payload.get("status_code")
      internal_status = _map_midtrans_status(transaction_status, fraud_status)
      notification_json = json.dumps(status_payload, separators=(",", ":"), ensure_ascii=True)
      paid_at = status_check_existing.get("paid_at") if status_check_existing else None
      if internal_status == "PAID" and not paid_at:
        paid_at = now
      with db_connection() as conn:
        insert_payment_event(
          conn,
          event_id=str(uuid4()),
          order_id=str(status_check_order_id),
          event_type="status_check",
          payload_json=notification_json,
          received_at=now,
        )
        update_payment_order_status(
          conn,
          order_id=str(status_check_order_id),
          status=internal_status,
          transaction_status=transaction_status,
          fraud_status=fraud_status,
          status_code=str(status_code) if status_code is not None else None,
          last_notification_json=notification_json,
          paid_at=paid_at,
          updated_at=now,
        )
      raise HTTPException(
        status_code=409,
        detail="Payment sudah dibuat. Silakan cek status pembayaran.",
      )
    if status_state == "not_found":
      with db_connection() as conn:
        update_payment_order_processing_status(
          conn,
          order_id=str(status_check_order_id),
          status="FAILED",
          updated_at=now,
        )
      raise HTTPException(
        status_code=409,
        detail="Payment sebelumnya gagal diproses. Silakan coba lagi.",
      )
    raise HTTPException(
      status_code=409,
      detail="Payment sedang diproses. Coba lagi sebentar.",
    )

  first_name, last_name = _split_name(customer_name)
  request_payload = {
    "transaction_details": {"order_id": order_id, "gross_amount": plan.price_idr},
    "credit_card": {"secure": True},
    "customer_details": {
      "first_name": first_name,
      "last_name": last_name,
      "email": customer_email,
      "phone": customer_phone,
    },
    "item_details": [
      {
        "id": f"plan-{plan.id}",
        "price": plan.price_idr,
        "quantity": 1,
        "name": f"ODIN {plan.name}",
      }
    ],
  }
  headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"Basic {_midtrans_auth_header(settings.midtrans_server_key)}",
  }
  snap_url = f"{_midtrans_snap_base_url(settings)}/snap/v1/transactions"
  try:
    response = requests.post(snap_url, headers=headers, json=request_payload, timeout=20)
  except requests.RequestException as exc:
    now = datetime.utcnow().isoformat() + "Z"
    with db_connection() as conn:
      update_payment_order_processing_status(
        conn,
        order_id=order_id,
        status="FAILED",
        updated_at=now,
      )
      insert_payment_event(
        conn,
        event_id=str(uuid4()),
        order_id=str(order_id),
        event_type="token_failed",
        payload_json=json.dumps({"error": str(exc)}, separators=(",", ":"), ensure_ascii=True),
        received_at=now,
      )
    raise HTTPException(status_code=502, detail="Failed to reach Midtrans.") from exc

  if response.status_code != 201:
    detail = "Midtrans token request failed."
    error_payload = {"status_code": response.status_code, "body": response.text}
    try:
      body = response.json()
      error_payload = body
      error_messages = body.get("error_messages")
      if isinstance(error_messages, list):
        detail = "; ".join(error_messages)
      elif error_messages:
        detail = str(error_messages)
      elif body.get("message"):
        detail = str(body["message"])
    except ValueError:
      detail = f"{detail} ({response.text})"
    now = datetime.utcnow().isoformat() + "Z"
    with db_connection() as conn:
      update_payment_order_processing_status(
        conn,
        order_id=order_id,
        status="FAILED",
        updated_at=now,
      )
      insert_payment_event(
        conn,
        event_id=str(uuid4()),
        order_id=str(order_id),
        event_type="token_failed",
        payload_json=json.dumps(error_payload, separators=(",", ":"), ensure_ascii=True),
        received_at=now,
      )
    raise HTTPException(status_code=502, detail=detail)

  data = response.json()
  token = data.get("token")
  if not token:
    raise HTTPException(status_code=502, detail="Midtrans response missing token.")

  now = datetime.utcnow().isoformat() + "Z"
  token_payload = {"token": token, "redirect_url": data.get("redirect_url")}
  with db_connection() as conn:
    insert_payment_event(
      conn,
      event_id=str(uuid4()),
      order_id=str(order_id),
      event_type="token_success",
      payload_json=json.dumps(token_payload, separators=(",", ":"), ensure_ascii=True),
      received_at=now,
    )
  with db_connection() as conn:
    updated = update_payment_order_token(
      conn,
      order_id=order_id,
      snap_token=token,
      updated_at=now,
      status="CREATED",
    )
    if not updated:
      existing = get_payment_order(conn, order_id)
      if existing and existing.get("snap_token"):
        return PaymentTokenResponse(
          order_id=order_id,
          token=existing["snap_token"],
          redirect_url=None,
        )
      raise HTTPException(status_code=409, detail="Payment already created.")

  return PaymentTokenResponse(
    order_id=order_id,
    token=token,
    redirect_url=data.get("redirect_url"),
  )


@router.post("/payments/midtrans/notify", tags=["payments"])
async def midtrans_notification(request: Request):
  payload = await request.json()
  if not isinstance(payload, dict):
    raise HTTPException(status_code=400, detail="Invalid notification payload.")

  order_id = payload.get("order_id")
  status_code = payload.get("status_code")
  gross_amount = payload.get("gross_amount")
  signature_key = payload.get("signature_key")
  if not order_id or not status_code or not gross_amount or not signature_key:
    raise HTTPException(status_code=400, detail="Missing notification fields.")

  settings = get_settings()
  if not settings.midtrans_server_key:
    raise HTTPException(status_code=500, detail="Midtrans server key missing.")

  expected = _midtrans_signature(
    order_id=str(order_id),
    status_code=str(status_code),
    gross_amount=str(gross_amount),
    server_key=settings.midtrans_server_key,
  )
  if signature_key != expected:
    raise HTTPException(status_code=403, detail="Invalid notification signature.")

  transaction_status = payload.get("transaction_status")
  fraud_status = payload.get("fraud_status")
  internal_status = _map_midtrans_status(transaction_status, fraud_status)
  notification_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
  now_dt = datetime.utcnow()
  now = now_dt.isoformat() + "Z"

  with db_connection() as conn:
    insert_payment_event(
      conn,
      event_id=str(uuid4()),
      order_id=str(order_id),
      event_type=f"notification:{internal_status.lower()}",
      payload_json=notification_json,
      received_at=now,
    )

    order = get_payment_order(conn, str(order_id))
    if not order:
      insert_payment_event(
        conn,
        event_id=str(uuid4()),
        order_id=str(order_id),
        event_type="unknown_order",
        payload_json=notification_json,
        received_at=now,
      )
      return {"received": True}

    expected_amount = int(order.get("gross_amount") or 0)
    incoming_amount = _parse_amount(gross_amount)
    if incoming_amount and expected_amount and incoming_amount != expected_amount:
      insert_payment_event(
        conn,
        event_id=str(uuid4()),
        order_id=str(order_id),
        event_type="amount_mismatch",
        payload_json=notification_json,
        received_at=now,
      )

    paid_at = order.get("paid_at")
    if internal_status == "PAID" and not paid_at:
      paid_at = now

    update_payment_order_status(
      conn,
      order_id=str(order_id),
      status=internal_status,
      transaction_status=transaction_status,
      fraud_status=fraud_status,
      status_code=str(status_code),
      last_notification_json=notification_json,
      paid_at=paid_at,
      updated_at=now,
    )

    if order and order.get("user_id"):
      subscription_status = _map_subscription_status(internal_status)
      user_id = str(order["user_id"])
      if subscription_status == "active":
        existing_period = get_subscription_period_by_order_id(conn, order_id=str(order_id))
        if existing_period:
          if existing_period.get("status") != "active":
            update_subscription_period_status(
              conn,
              order_id=str(order_id),
              status="active",
              updated_at=now,
            )
        else:
          latest_active = get_latest_active_subscription_period(conn, user_id=user_id)
          started_at, current_period_end = _next_billing_period(
            latest_active.get("period_end") if latest_active else None,
            now_dt,
          )
          create_subscription_period(
            conn,
            period_id=str(uuid4()),
            user_id=user_id,
            order_id=str(order_id),
            plan_id=order.get("plan_id") or "unknown",
            status="active",
            period_start=started_at,
            period_end=current_period_end,
            created_at=now,
            updated_at=now,
          )
        _refresh_subscription_snapshot(conn, user_id, now_dt)
      elif subscription_status == "canceled":
        existing_period = get_subscription_period_by_order_id(conn, order_id=str(order_id))
        if existing_period:
          update_subscription_period_status(
            conn,
            order_id=str(order_id),
            status="canceled",
            updated_at=now,
          )
          _refresh_subscription_snapshot(conn, user_id, now_dt)
        else:
          subscription = get_subscription(conn, user_id)
          if subscription and subscription.get("order_id") == str(order_id):
            upsert_subscription(
              conn,
              user_id=user_id,
              plan_id=order.get("plan_id") or "unknown",
              status="canceled",
              order_id=str(order_id),
              started_at=subscription.get("started_at"),
              current_period_end=now,
              created_at=now,
              updated_at=now,
            )

  return {"received": True}


@router.get("/payments/midtrans/status", response_model=PaymentStatusResponse, tags=["payments"])
async def midtrans_status(request: Request, order_id: str) -> PaymentStatusResponse:
  user_id = _require_user_id(request)
  with db_connection() as conn:
    order = get_payment_order(conn, order_id)
  if not order or str(order.get("user_id")) != user_id:
    raise HTTPException(status_code=404, detail="Order not found.")
  return PaymentStatusResponse(
    order_id=order["order_id"],
    status=order["status"],
    transaction_status=order.get("transaction_status"),
    fraud_status=order.get("fraud_status"),
    status_code=order.get("status_code"),
    gross_amount=order.get("gross_amount"),
    currency=order.get("currency"),
    paid_at=order.get("paid_at"),
    updated_at=order.get("updated_at"),
  )


@router.get("/subscriptions/me", response_model=SubscriptionStatusResponse, tags=["subscriptions"])
async def get_subscription_me(request: Request) -> SubscriptionStatusResponse:
  user_id = _require_user_id(request)
  with db_connection() as conn:
    subscription = get_subscription(conn, user_id)
  if not subscription:
    raise HTTPException(status_code=404, detail="Subscription not found.")
  return SubscriptionStatusResponse(**subscription)


@router.get("/projects", tags=["projects"])
async def list_projects_handler(request: Request):
  owner_id = _require_user_id(request)
  with db_connection() as conn:
    projects = list_projects(conn, owner_id)
  return {"projects": projects}


@router.post("/projects", tags=["projects"])
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


@router.patch("/projects/{project_id}", tags=["projects"])
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


@router.get("/projects/{project_id}", tags=["projects"])
async def get_project_handler(request: Request, project_id: str):
  resolved_owner = _require_user_id(request)
  with db_connection() as conn:
    project = get_project(conn, resolved_owner, project_id)
    if not project:
      raise HTTPException(status_code=404, detail="Project not found.")
    generations = list_generations(conn, project_id)
  return {"project": project, "generations": generations}


@router.post("/projects/{project_id}/slide-image", tags=["projects"])
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


@router.get("/projects/{project_id}/slide-image", tags=["projects"])
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


@router.delete("/projects/{project_id}/slide-image", tags=["projects"])
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


@router.delete("/projects/{project_id}", tags=["projects"])
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


@router.get("/generations/{generation_id}/image", tags=["generations"])
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


@router.post("/generate", tags=["generation"])
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


@router.post("/auth/register", tags=["auth"])
async def register_user(request: Request, payload: dict):
  _rate_limit_auth(request, "register")
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


@router.post("/auth/login", tags=["auth"])
async def login_user(request: Request, payload: dict):
  _rate_limit_auth(request, "login")
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


@router.post("/auth/forgot-password", tags=["auth"])
async def forgot_password(request: Request, payload: dict):
  _rate_limit_auth(request, "forgot-password")
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


@router.post("/auth/reset-password", tags=["auth"])
async def reset_password(request: Request, payload: dict):
  _rate_limit_auth(request, "reset-password")
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


app.include_router(router)

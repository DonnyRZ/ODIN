from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import bcrypt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings


@dataclass(frozen=True)
class GoogleUser:
  sub: str
  email: str
  name: str


def verify_google_token(token: str) -> Optional[GoogleUser]:
  settings = get_settings()
  if not settings.google_client_id:
    return None
  try:
    payload = id_token.verify_oauth2_token(token, google_requests.Request(), settings.google_client_id)
  except Exception:
    return None

  sub = payload.get("sub")
  email = payload.get("email")
  name = payload.get("name") or payload.get("given_name") or ""
  if not sub or not email:
    return None
  return GoogleUser(sub=sub, email=email, name=name)


def hash_password(password: str) -> str:
  salt = bcrypt.gensalt()
  return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
  try:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
  except ValueError:
    return False

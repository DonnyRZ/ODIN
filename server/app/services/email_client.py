from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("odin")


def send_email(to_address: str, subject: str, body: str) -> None:
  settings = get_settings()
  if not settings.smtp_host or not settings.smtp_from:
    raise RuntimeError("Email service not configured.")

  message = EmailMessage()
  message["Subject"] = subject
  message["From"] = settings.smtp_from
  message["To"] = to_address
  message.set_content(body)

  if settings.smtp_use_tls:
    context = ssl.create_default_context()
    server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context)
  else:
    server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
    if settings.smtp_use_starttls:
      server.starttls(context=ssl.create_default_context())

  try:
    if settings.smtp_user:
      server.login(settings.smtp_user, settings.smtp_password)
    server.send_message(message)
  finally:
    try:
      server.quit()
    except smtplib.SMTPException:
      logger.warning("Failed to close SMTP connection cleanly.")

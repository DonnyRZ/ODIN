"""
Entry point so `uvicorn uvicorn_app:app --reload` just works.
"""

from app.main import app  # noqa: F401

# ODIN FastAPI Service

Lightweight backend that orchestrates future LLM + image generation workflows. Right now it returns mock visuals so the Next.js workspace can exercise the full request/response pipeline.

## Prerequisites

- Python 3.11+
- `pip` (or `uv`/`pipx`) installed locally

## Install dependencies

```bash
cd server
python -m venv .venv
.venv\Scripts\activate  # or source .venv/bin/activate on macOS/Linux
pip install -e .
```

## Run the dev server

```bash
uvicorn uvicorn_app:app --reload
```

The API listens on `http://localhost:8000` by default.

## API routes

- `GET /health` – sanity check
- `POST /generate` – accepts project/prompt/selection payloads and returns mock visual metadata. This endpoint is what the Next.js workspace hits today; we will swap the mock response with real LLM + image generation logic later.

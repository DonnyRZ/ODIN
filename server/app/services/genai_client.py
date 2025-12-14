from __future__ import annotations

import base64
from typing import List

from google import genai
from google.genai import types

from app.core.config import get_settings


settings = get_settings()

ASPECT_RATIO_MAP = {
  "square": ("square", "a square icon or badge"),
  "portrait_9x16": ("portrait", "a tall story-style panel"),
  "landscape_16x9": ("landscape", "a widescreen slide illustration"),
}


def _decode_image_data(data_url: str) -> tuple[str, bytes]:
  if not data_url:
    raise ValueError("Slide image missing.")

  if data_url.startswith("data:"):
    header, b64data = data_url.split(",", 1)
    mime = header.split(";")[0].replace("data:", "") or "image/png"
  else:
    mime = "image/png"
    b64data = data_url

  try:
    return mime, base64.b64decode(b64data)
  except Exception as exc:  # pragma: no cover
    raise ValueError("Invalid slide image data.") from exc


class GenAIClient:
  def __init__(self):
    self.prompt_client = genai.Client(api_key=settings.genai_api_key)
    self.image_client = genai.Client(api_key=settings.image_ai_key)
    self.prompt_model = settings.genai_model
    self.image_model = settings.image_model

  def enhance_prompt(
    self,
    user_prompt: str,
    slide_context: str,
    creativity: float,
    slide_image_base64: str,
  ) -> str:
    if creativity <= 0:
      return user_prompt
    if creativity >= 1:
      creativity_weight = 1.0
    else:
      creativity_weight = creativity

    instructions = """
You are rewriting a prompt for a presentation-quality visual. Apply these best practices:
- Be hyper-specific about subjects, colors, lighting, and layout so the designer has full control.
- Keep the tone positive; describe what should exist instead of what to avoid.
- Provide step-by-step composition guidance (foreground, midground, background).
- Suggest camera direction or viewpoint that fits the visual.
- Maintain a cohesive, modern product-deck style.
- Ensure only the background is white; all other elements use rich colors.
"""

    mime_type, image_bytes = _decode_image_data(slide_image_base64)

    context_text = slide_context or "No additional slide copy provided."

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    text_part = types.Part.from_text(
      f"""{instructions.strip()}

Slide visual provided above.
Slide context text:
{context_text}

User prompt:
{user_prompt}

Rewrite the prompt, embedding those principles."""
    )

    response = self.prompt_client.models.generate_content(
      model=self.prompt_model,
      contents=[
        types.Content(role="user", parts=[image_part, text_part]),
      ],
      config=types.GenerateContentConfig(),
    )
    ai_prompt = response.text.strip() if response.text else user_prompt

    if creativity_weight >= 0.99:
      return ai_prompt

    return f"{user_prompt}\n\n[AI suggestion]\n{ai_prompt}"

  def generate_images(self, prompt: str, aspect_ratio: str, count: int) -> List[bytes]:
    _, ratio_label = ASPECT_RATIO_MAP.get(aspect_ratio, ("square", "a square icon"))
    prompt_template = f"""
Create a presentation-ready, flat/minimal vector visual for {ratio_label}. Ensure only the background is pure white while all shapes/typography use rich colors. Context: {prompt}
"""

    results = []
    for _ in range(count):
      response = self.image_client.models.generate_content(
        model=self.image_model,
        contents=[
          {
            "role": "user",
            "parts": [
              {
                "text": prompt_template.strip(),
              }
            ],
          }
        ],
        config=types.GenerateContentConfig(
          systemInstruction="""
You are a presentation visual designer. Enforce strictly:
  - The only white element allowed is the background (#FFFFFF).
  - All icons, shapes, typography, and decorative strokes must use distinct, non-white colors.
""".strip(),
          response_modalities=["IMAGE"],
        ),
      )

      image_bytes = None
      for candidate in response.candidates or []:
        for part in candidate.content.parts:
          if hasattr(part, "inline_data") and part.inline_data:
            image_bytes = part.inline_data.data
            break
        if image_bytes:
          break

      if not image_bytes:
        raise RuntimeError("Image generation returned no data.")

      results.append(image_bytes)

    return results


genai_client = GenAIClient()

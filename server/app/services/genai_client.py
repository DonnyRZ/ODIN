from __future__ import annotations

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


class GenAIClient:
  def __init__(self):
    self.prompt_client = genai.Client(api_key=settings.genai_api_key)
    self.image_client = genai.Client(api_key=settings.image_ai_key)
    self.prompt_model = settings.genai_model
    self.image_model = settings.image_model

  def enhance_prompt(self, user_prompt: str, slide_context: str, creativity: float) -> str:
    if creativity <= 0:
      return user_prompt
    if creativity >= 1:
      creativity_weight = 1.0
    else:
      creativity_weight = creativity

    response = self.prompt_client.models.generate_content(
      model=self.prompt_model,
      contents=[
        {
          "role": "user",
          "parts": [
            {
              "text": f"""Slide context:\n{slide_context}\n\nUser prompt:\n{user_prompt}\n\nRewrite the prompt to keep it on-context but more imaginative. Use short sentences."""
            }
          ],
        }
      ],
    )
    ai_prompt = response.text.strip() if response.text else user_prompt

    if creativity_weight >= 0.99:
      return ai_prompt

    return f"{user_prompt}\n\n[AI suggestion]\n{ai_prompt}"

  def generate_images(self, prompt: str, aspect_ratio: str, count: int) -> List[bytes]:
    _, ratio_label = ASPECT_RATIO_MAP.get(aspect_ratio, ("square", "a square icon"))
    prompt_template = f"""
Goal: craft a presentation-ready, flat/minimal vector-style visual that fits {ratio_label}.
Hard rule: the background must be solid white, but every shape, line, or typographic element must use saturated, non-white colors.
Context and intent:
{prompt}

Best-practice instructions:
1. Be hyper-specific about objects, colors, lighting, and layout so the slide designer has full control.
2. Keep the tone positive; describe what should exist instead of what to avoid.
3. Provide step-by-step composition guidance (foreground, midground, background).
4. Suggest camera direction (e.g., isometric, low-angle, macro) that suits {ratio_label}.
5. Ensure the artwork feels cohesive with modern product pitch decks and uses a solid white background.
6. Use bold, non-white colors for all shapes, lines, and typography; only the background may be pure white.
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

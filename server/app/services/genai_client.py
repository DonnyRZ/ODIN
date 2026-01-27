from __future__ import annotations

import base64
from typing import List

from google import genai
from google.genai import types

from app.core.config import get_settings


ASPECT_RATIO_MAP = {
  "square": ("square", "a square visual panel"),
  "portrait_9x16": ("portrait", "a tall story-style panel"),
  "landscape_16x9": ("landscape", "a widescreen visual panel"),
}

PROMPT_INSTRUCTIONS = """
You are enhancing a prompt for a presentation-ready visual.
- The user prompt is the SOURCE OF TRUTH for the subject/action. Do not change the subject.
- Analyze the provided slide image to infer palette, mood, props, and layout cues, but never recreate or describe the slide content.
- Use the slide context only to suggest styling cues that support the user prompt.
- The visual must depict only the subject; avoid adding background props, desks, environment scenes, or UI chrome unless the user explicitly asks for them.
- Background must be a solid chromakey green (#00FF00) with no gradients, lighting, shadows, or texture.
- The subject must have a clean white outline (2-3px) separating it from the background.
- Do not use green hues on the subject; if needed, use teal or forest green instead.
- Unless the user requests it, do not include any text, lettering, or typographic elements in the visual.
- Best practices: be hyper-specific, keep tone positive, describe foreground/midground/background separation, suggest camera direction, and emphasize crisp edges.

Output a single cohesive sentence that begins with "Subject (source of truth): ..." followed by "Style:" with slide-inspired cues. Never mention text from the slide.
"""


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


def _chromakey_retry_instructions(retry: int) -> str:
  if retry <= 0:
    return ""
  lines = [
    "EXTRA CHROMAKEY CONSTRAINTS:",
    "- Background must be a single flat #00FF00 with zero variation.",
    "- Remove all gradients, shadows, reflections, or textures on the background.",
    "- Outline must be solid white and continuous around the subject.",
  ]
  if retry >= 2:
    lines.append("- Eliminate any soft edges or color bleed between subject and background.")
  return "\n".join(lines)


class GenAIClient:
  def __init__(self):
    settings = get_settings()
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
      return f"Subject (source of truth): {user_prompt}"
    if creativity >= 1:
      creativity_weight = 1.0
    else:
      creativity_weight = creativity

    mime_type, image_bytes = _decode_image_data(slide_image_base64)

    context_text = slide_context or "No additional slide copy provided."

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    text_part = types.Part.from_text(
      text=f"""{PROMPT_INSTRUCTIONS.strip()}

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
    ai_prompt = (response.text or "").strip()

    if creativity_weight <= 0:
      return f"Subject (source of truth): {user_prompt}"

    if not ai_prompt:
      return f"Subject (source of truth): {user_prompt}"

    return f"Subject (source of truth): {user_prompt}\n\n{ai_prompt}"

  def generate_images(
    self,
    prompt: str,
    aspect_ratio: str,
    count: int,
    chromakey_retry: int = 0,
  ) -> List[bytes]:
    _, ratio_label = ASPECT_RATIO_MAP.get(aspect_ratio, ("square", "a square visual panel"))
    retry_instructions = _chromakey_retry_instructions(chromakey_retry)
    prompt_template = f"""
Create a presentation-ready illustration for {ratio_label}. Render only the subject with a clean white outline (2-3px) that traces the entire silhouette so it stands apart from the background. Keep the subject's materials and colors faithful to the prompt and real-world expectations--never recolor the subject just to add contrast. The background must be a solid chromakey green (#00FF00) with no gradients, shadows, textures, or lighting variation. Do not use green hues on the subject; if green is required, use teal or forest green instead. Keep edges crisp and well-defined. Center the subject with comfortable padding around all sides. Do not include any text, lettering, dashboards, or UI chrome unless the user explicitly asks for them.

{retry_instructions}

Context: {prompt}
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
  - Render only the subject; remove desks, devices, furniture, scenery, or UI chrome unless specifically requested.
  - Add a clean white outline (2-3px) around the subject so edges are unambiguous.
  - Preserve subject colors exactly as described (skin, fur, materials stay natural); never recolor the subject for contrast.
  - The background must be solid chromakey green (#00FF00) with no gradients, shadows, or texture.
  - Do not use green hues on the subject; use teal or forest green if green is required.
  - Keep edges crisp, with centered framing and padding.
  - Do not include text, lettering, dashboards, or other typographic/UI elements unless the user explicitly asks for them.
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

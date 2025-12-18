from __future__ import annotations

import logging
from functools import lru_cache
from io import BytesIO
from time import perf_counter
from typing import Tuple

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove


MAX_PROCESS_SIDE = 1100
BACKGROUND_TINT = (160, 160, 160)
FLOOD_TOLERANCE = 12
MORPH_KERNEL_SIZE = (7, 7)
COVERAGE_THRESHOLD = 0.92
BACKGROUND_BRIGHTNESS_TRIGGER = 200

logger = logging.getLogger("odin")


@lru_cache(maxsize=1)
def _get_isnet_session():
  return new_session("isnet-general-use", providers=["CPUExecutionProvider"])


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
  rgba = np.array(image.convert("RGBA"))
  return cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGR)


def _bgr_to_pil(bgr: np.ndarray) -> Image.Image:
  rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGBA)
  return Image.fromarray(rgba, "RGBA")


def _isnet_mask(image: Image.Image) -> np.ndarray:
  start = perf_counter()
  mask = remove(
    image,
    session=_get_isnet_session(),
    only_mask=True,
    post_process_mask=True,
  )
  logger.info("IS-Net inference took %.2fs for %sx%s", perf_counter() - start, image.width, image.height)
  return np.array(mask.convert("L"), dtype=np.uint8)


def _floodfill_background_mask(bgr: np.ndarray, tolerance: int) -> np.ndarray:
  height, width = bgr.shape[:2]
  accumulated = np.zeros((height, width), dtype=np.uint8)

  def flood(seed_x: int, seed_y: int) -> np.ndarray:
    flood_mask = np.zeros((height + 2, width + 2), dtype=np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    lo = (tolerance, tolerance, tolerance)
    up = (tolerance, tolerance, tolerance)
    cv2.floodFill(bgr.copy(), flood_mask, (seed_x, seed_y), (0, 0, 0), lo, up, flags)
    return flood_mask[1:-1, 1:-1]

  corners = ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))
  for x, y in corners:
    accumulated = cv2.bitwise_or(accumulated, flood(x, y))

  return (accumulated > 0).astype(np.uint8) * 255


def _tint_background(bgr: np.ndarray, bg_mask: np.ndarray, tint: Tuple[int, int, int]) -> np.ndarray:
  tinted = bgr.copy()
  tinted[bg_mask > 0] = np.array(tint, dtype=np.uint8)
  return tinted


def _should_run_tinted_pass(mask_u8: np.ndarray, bgr: np.ndarray, bg_mask: np.ndarray) -> bool:
  if not np.any(bg_mask):
    return False

  coverage = float(mask_u8.mean()) / 255.0
  if coverage >= COVERAGE_THRESHOLD:
    return False

  gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
  bg_pixels = gray[bg_mask > 0]
  if bg_pixels.size == 0:
    return False

  background_brightness = float(bg_pixels.mean())
  return background_brightness >= BACKGROUND_BRIGHTNESS_TRIGGER


def _fill_holes(binary: np.ndarray) -> np.ndarray:
  img = (binary * 255).astype(np.uint8)
  height, width = img.shape[:2]
  filled = img.copy()
  mask = np.zeros((height + 2, width + 2), dtype=np.uint8)
  cv2.floodFill(filled, mask, (0, 0), 255)
  inverted = cv2.bitwise_not(filled)
  combined = cv2.bitwise_or(img, inverted)
  return (combined > 0).astype(np.uint8)


def _improve_mask(mask_u8: np.ndarray) -> np.ndarray:
  foreground = (mask_u8 >= 20).astype(np.uint8)
  kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, MORPH_KERNEL_SIZE)
  foreground = cv2.morphologyEx(foreground, cv2.MORPH_CLOSE, kernel, iterations=1)
  foreground = _fill_holes(foreground)
  foreground = cv2.dilate(foreground, kernel, iterations=1)
  return np.maximum(mask_u8, foreground.astype(np.uint8) * 255)


def _resize_if_needed(image: Image.Image, max_side: int) -> Image.Image:
  width, height = image.size
  longest = max(width, height)
  if longest <= max_side:
    return image
  scale = max_side / float(longest)
  new_size = (int(width * scale), int(height * scale))
  return image.resize(new_size, Image.LANCZOS)


def _image_to_png_bytes(image: Image.Image) -> bytes:
  buffer = BytesIO()
  image.save(buffer, format="PNG")
  return buffer.getvalue()


def remove_background(image_bytes: bytes) -> bytes:
  total_start = perf_counter()
  base_image = Image.open(BytesIO(image_bytes)).convert("RGBA")
  processed = _resize_if_needed(base_image, MAX_PROCESS_SIDE)
  if processed.size != base_image.size:
    logger.info(
      "Downscaled slide from %sx%s to %sx%s",
      base_image.width,
      base_image.height,
      processed.width,
      processed.height,
    )

  bgr = _pil_to_bgr(processed)
  bg_mask = _floodfill_background_mask(bgr, FLOOD_TOLERANCE)

  mask_original = _isnet_mask(processed)
  combined_mask = mask_original

  tinted_needed = _should_run_tinted_pass(mask_original, bgr, bg_mask)
  logger.info("Tinted pass required: %s", tinted_needed)

  if tinted_needed:
    tint_start = perf_counter()
    tinted = _tint_background(bgr, bg_mask, BACKGROUND_TINT)
    mask_tinted = _isnet_mask(_bgr_to_pil(tinted))
    combined_mask = np.maximum(mask_original, mask_tinted)
    logger.info("Tinted pass union took %.2fs", perf_counter() - tint_start)

  refine_start = perf_counter()
  refined_alpha = _improve_mask(combined_mask)
  logger.info("Mask refinement took %.2fs", perf_counter() - refine_start)

  rgba = np.array(processed, dtype=np.uint8)
  rgba[:, :, 3] = refined_alpha
  if processed.size != base_image.size:
    rgba = cv2.resize(rgba, base_image.size, interpolation=cv2.INTER_LINEAR)

  final_image = Image.fromarray(rgba, "RGBA")
  output = _image_to_png_bytes(final_image)
  logger.info("Background removal total %.2fs", perf_counter() - total_start)
  return output

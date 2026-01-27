from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO
from time import perf_counter

import cv2
import numpy as np
from PIL import Image

HUE_CENTER_DEGREES = 120
HUE_RANGE_DEGREES = 25
MIN_SATURATION_PERCENT = 75
MIN_VALUE_PERCENT = 70
DILATION_ITERATIONS = 2
ALPHA_THRESHOLD = 64
BORDER_FRACTION = 0.1
MIN_BORDER_GREEN_RATIO = 0.92
MIN_SUBJECT_RATIO = 0.08

logger = logging.getLogger("odin")


@dataclass(frozen=True)
class ChromakeyMetrics:
  border_green_ratio: float
  subject_ratio: float
  passed: bool


def _decode_image(image_bytes: bytes) -> Image.Image:
  return Image.open(BytesIO(image_bytes)).convert("RGBA")


def _green_mask(hsv: np.ndarray) -> np.ndarray:
  h = hsv[:, :, 0]
  s = hsv[:, :, 1]
  v = hsv[:, :, 2]

  hue_center = int(round(HUE_CENTER_DEGREES / 2))
  hue_range = int(round(HUE_RANGE_DEGREES / 2))
  low = (hue_center - hue_range) % 180
  high = (hue_center + hue_range) % 180

  if low <= high:
    hue_mask = (h >= low) & (h <= high)
  else:
    hue_mask = (h >= low) | (h <= high)

  min_s = int(round(MIN_SATURATION_PERCENT / 100 * 255))
  min_v = int(round(MIN_VALUE_PERCENT / 100 * 255))
  return hue_mask & (s >= min_s) & (v >= min_v)


def _quality_metrics(green_mask: np.ndarray) -> ChromakeyMetrics:
  height, width = green_mask.shape
  border_x = max(1, int(width * BORDER_FRACTION))
  border_y = max(1, int(height * BORDER_FRACTION))

  border_mask = np.zeros_like(green_mask, dtype=bool)
  border_mask[:border_y, :] = True
  border_mask[-border_y:, :] = True
  border_mask[:, :border_x] = True
  border_mask[:, -border_x:] = True

  if border_mask.any():
    border_ratio = float(green_mask[border_mask].mean())
  else:
    border_ratio = 0.0

  subject_ratio = 1.0 - float(green_mask.mean())

  passed = border_ratio >= MIN_BORDER_GREEN_RATIO and subject_ratio >= MIN_SUBJECT_RATIO
  return ChromakeyMetrics(border_green_ratio=border_ratio, subject_ratio=subject_ratio, passed=passed)


def _apply_alpha_cleanup(alpha: np.ndarray) -> np.ndarray:
  if ALPHA_THRESHOLD <= 0:
    return alpha
  cleaned = np.where(alpha < ALPHA_THRESHOLD, 0, 255).astype(np.uint8)
  return cleaned


def process_chromakey(image_bytes: bytes) -> tuple[bytes, ChromakeyMetrics]:
  total_start = perf_counter()
  image = _decode_image(image_bytes)
  rgba = np.array(image, dtype=np.uint8)
  rgb = rgba[:, :, :3]

  hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
  green_mask = _green_mask(hsv)
  metrics = _quality_metrics(green_mask)

  if DILATION_ITERATIONS > 0:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    green_mask = cv2.dilate(green_mask.astype(np.uint8), kernel, iterations=DILATION_ITERATIONS) > 0

  alpha = rgba[:, :, 3]
  alpha[green_mask] = 0
  rgba[:, :, 3] = _apply_alpha_cleanup(alpha)

  output = Image.fromarray(rgba, "RGBA")
  buffer = BytesIO()
  output.save(buffer, format="PNG")
  logger.info("Chromakey removal took %.2fs", perf_counter() - total_start)
  return buffer.getvalue(), metrics

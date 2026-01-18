from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass(frozen=True)
class Plan:
  id: str
  name: str
  price_idr: int
  summary: str
  features: List[str]


def get_plan_catalog() -> List[Plan]:
  return [
    Plan(
      id="starter",
      name="Starter",
      price_idr=89000,
      summary="Perfect for light personal projects and quick cleanup work.",
      features=[
        "Background remover: 3x per day",
        "Visual generation: 15 images per day",
        "3 active projects at a time",
        "Save and reuse prompts",
        "Side panel extension access",
      ],
    ),
    Plan(
      id="pro",
      name="Pro",
      price_idr=199000,
      summary="For frequent slide builders who need faster output and more options.",
      features=[
        "Everything in Starter",
        "Background remover: 15x per day",
        "Visual generation: 20 images per day",
        "Up to 3 variants per prompt",
        "10 active projects at a time",
        "Priority processing queue",
      ],
    ),
    Plan(
      id="premium",
      name="Premium",
      price_idr=359000,
      summary="For heavy production workflows that demand more output and speed.",
      features=[
        "Everything in Pro",
        "Background remover: 40x per day",
        "Visual generation: 40 images per day",
        "Up to 5 variants per prompt",
        "Highest priority queue",
      ],
    ),
  ]

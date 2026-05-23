"""
services/video_extraction_service.py

Mock video extraction pipeline for demo purposes.
Simulates frame analysis + OCR output from uploaded product videos.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass
class VideoExtractionResult:
    product_title: str | None
    brand: str | None
    category: str | None
    color: str | None
    material: str | None
    description: str | None
    price: float | None
    mrp: float | None
    missing_fields: list[str]


class MockVideoExtractor:
    """Generates deterministic mock extraction from video filename."""

    _CATALOG = [
        {
            "category": "Running Shoes",
            "brand": "Nike",
            "color": "Blue",
            "material": "Mesh",
            "base_title": "Nike Blue Running Shoes",
            "description": "Lightweight running shoes with breathable mesh upper and cushioned sole for daily training.",
            "price": 3999.0,
            "mrp": 4999.0,
        },
        {
            "category": "Backpack",
            "brand": "Puma",
            "color": "Black",
            "material": "Polyester",
            "base_title": "Puma Black Travel Backpack",
            "description": "Durable travel backpack with multi-compartment storage for office and weekend use.",
            "price": 1799.0,
            "mrp": 2499.0,
        },
        {
            "category": "Casual Shirt",
            "brand": "Levis",
            "color": "White",
            "material": "Cotton",
            "base_title": "Levis White Casual Shirt for Men",
            "description": "Comfort fit cotton shirt suitable for daily wear with breathable fabric and soft finish.",
            "price": 1299.0,
            "mrp": 1999.0,
        },
    ]

    def extract(self, original_filename: str) -> VideoExtractionResult:
        seed = self._seed(original_filename)
        base = self._CATALOG[seed % len(self._CATALOG)]

        # Simulate imperfect extraction by dropping one or two fields by seed.
        missing_fields: list[str] = []
        title = base["base_title"]
        brand = base["brand"]
        color = base["color"]
        material = base["material"]

        if seed % 4 == 0:
            title = None
            missing_fields.append("product_title")
        if seed % 5 == 0:
            brand = None
            missing_fields.append("brand")
        if seed % 6 == 0:
            color = None
            missing_fields.append("color")

        return VideoExtractionResult(
            product_title=title,
            brand=brand,
            category=base["category"],
            color=color,
            material=material,
            description=base["description"],
            price=base["price"],
            mrp=base["mrp"],
            missing_fields=missing_fields,
        )

    def _seed(self, name: str) -> int:
        digest = hashlib.md5(name.lower().encode("utf-8")).hexdigest()
        return int(digest[:8], 16)

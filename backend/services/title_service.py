"""
services/title_service.py

Rule-based title enhancement service (AI/ML-friendly mocked pipeline).
Stores extracted attributes, suggested keywords, enhanced title and reason.
"""
from __future__ import annotations

import json
from typing import Dict, List

from sqlalchemy.orm import Session

from models import Product


class TitleEnhancer:
    """Generates improved product titles from available attributes and keyword templates."""

    _CATEGORY_KEYWORDS = {
        "shoes": ["running shoes", "lightweight shoes", "sports shoes for men"],
        "dress": ["party wear", "stylish fit", "comfortable fabric"],
        "bags": ["durable bag", "daily use", "spacious design"],
        "watch": ["premium watch", "water resistant", "stylish dial"],
        "default": ["best quality", "value for money", "trending style"],
    }

    def enhance_and_persist(self, db: Session, product: Product) -> Product:
        attrs = self._extract_attributes(product)
        keywords = self._suggest_keywords(product.category or "", attrs)
        enhanced = self._build_title(product, attrs, keywords)

        product.title_attributes = json.dumps(attrs)
        product.title_keywords = json.dumps(keywords)
        product.enhanced_title = enhanced
        product.title_enhancement_reason = (
            "Enhanced title generated from extracted attributes and category keywords."
        )
        db.commit()
        db.refresh(product)
        return product

    def _extract_attributes(self, product: Product) -> Dict[str, str]:
        attrs: Dict[str, str] = {}

        if product.brand:
            attrs["brand"] = product.brand.strip()
        if product.color:
            attrs["color"] = product.color.strip()
        if product.material:
            attrs["material"] = product.material.strip()

        category = (product.category or "").strip()
        if category:
            attrs["product_type"] = category

        # Lightweight heuristic extraction from existing title.
        title = (product.product_title or "").lower()
        if "men" in title:
            attrs["gender"] = "Men"
        elif "women" in title:
            attrs["gender"] = "Women"
        elif "unisex" in title:
            attrs["gender"] = "Unisex"

        return attrs

    def _suggest_keywords(self, category: str, attrs: Dict[str, str]) -> List[str]:
        c = (category or "").lower()
        for key, kws in self._CATEGORY_KEYWORDS.items():
            if key != "default" and key in c:
                return kws
        return self._CATEGORY_KEYWORDS["default"]

    def _build_title(self, product: Product, attrs: Dict[str, str], keywords: List[str]) -> str:
        parts: List[str] = []

        if attrs.get("brand"):
            parts.append(attrs["brand"])
        if attrs.get("color"):
            parts.append(attrs["color"])

        if attrs.get("product_type"):
            parts.append(attrs["product_type"])
        elif product.product_title:
            parts.append(product.product_title.strip())

        if attrs.get("gender"):
            parts.append(f"for {attrs['gender']}")

        if attrs.get("material"):
            parts.append(f"with {attrs['material']} build")

        # Include one high-signal keyword phrase.
        if keywords:
            parts.append(f"- {keywords[0]}")

        enhanced = " ".join(p for p in parts if p).strip()
        return enhanced if enhanced else (product.product_title or "Untitled Product")

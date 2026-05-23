"""
services/validation_service.py

OOP validation engine for listing-quality checks.
Each validation run replaces existing issues for the SKU and recalculates quality_score.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from models import Product, ProductIssue


@dataclass
class ValidationRuleResult:
    issue_type: str
    severity: str
    message: str
    suggested_fix: str


class ListingValidator:
    """Encapsulates listing quality validation logic for Product entities."""

    HIGH_PENALTY = 25
    MEDIUM_PENALTY = 12
    LOW_PENALTY = 5

    def validate_and_persist(self, db: Session, product: Product, duplicate_sku: bool = False) -> List[ValidationRuleResult]:
        """
        Validate one product, persist ProductIssue rows, and update product.quality_score.
        Returns a list of detected issues.
        """
        issues = self._validate(product, duplicate_sku=duplicate_sku)

        # Replace existing issues for deterministic re-validation behavior.
        db.query(ProductIssue).filter(ProductIssue.sku_id == product.sku_id).delete()

        for issue in issues:
            db.add(
                ProductIssue(
                    sku_id=product.sku_id,
                    issue_type=issue.issue_type,
                    severity=issue.severity,
                    message=issue.message,
                    suggested_fix=issue.suggested_fix,
                )
            )

        product.quality_score = self._calculate_quality_score(issues)
        db.commit()
        db.refresh(product)
        return issues

    def _validate(self, product: Product, duplicate_sku: bool = False) -> List[ValidationRuleResult]:
        issues: List[ValidationRuleResult] = []

        title = (product.product_title or "").strip()
        description = (product.description or "").strip()
        brand = (product.brand or "").strip()
        image_url = (product.image_url or "").strip()

        # Missing title
        if not title:
            issues.append(
                ValidationRuleResult(
                    issue_type="MISSING_TITLE",
                    severity="HIGH",
                    message="Product title is missing.",
                    suggested_fix="Add a clear product title with brand and product type.",
                )
            )

        # Very short title
        if title and len(title) < 12:
            issues.append(
                ValidationRuleResult(
                    issue_type="VERY_SHORT_TITLE",
                    severity="MEDIUM",
                    message="Product title is too short.",
                    suggested_fix="Include brand, product type, and key attributes in the title.",
                )
            )

        # Missing brand
        if not brand:
            issues.append(
                ValidationRuleResult(
                    issue_type="MISSING_BRAND",
                    severity="MEDIUM",
                    message="Brand is missing.",
                    suggested_fix="Add brand name or mark as unbranded if unknown.",
                )
            )

        # Invalid price
        if product.price is None or product.price <= 0:
            issues.append(
                ValidationRuleResult(
                    issue_type="INVALID_PRICE",
                    severity="HIGH",
                    message="Selling price is missing or invalid.",
                    suggested_fix="Provide a numeric selling price greater than zero.",
                )
            )

        # MRP lower than selling price
        if product.price is not None and product.mrp is not None and product.mrp < product.price:
            issues.append(
                ValidationRuleResult(
                    issue_type="MRP_LOWER_THAN_PRICE",
                    severity="HIGH",
                    message="MRP is lower than selling price.",
                    suggested_fix="Correct MRP or selling price so MRP >= selling price.",
                )
            )

        # Missing image
        if not image_url:
            issues.append(
                ValidationRuleResult(
                    issue_type="MISSING_IMAGE",
                    severity="HIGH",
                    message="Product image URL is missing.",
                    suggested_fix="Add at least one product image URL.",
                )
            )

        # Broken image URL (basic format check)
        if image_url and not (image_url.startswith("http://") or image_url.startswith("https://")):
            issues.append(
                ValidationRuleResult(
                    issue_type="BROKEN_IMAGE_URL",
                    severity="MEDIUM",
                    message="Image URL is not a valid web URL.",
                    suggested_fix="Use an accessible http(s) image URL.",
                )
            )

        # Duplicate SKU in input batch
        if duplicate_sku:
            issues.append(
                ValidationRuleResult(
                    issue_type="DUPLICATE_SKU",
                    severity="HIGH",
                    message="Duplicate SKU detected in uploaded CSV.",
                    suggested_fix="Ensure every row has a unique SKU ID.",
                )
            )

        # Weak description
        if not description or len(description) < 40:
            issues.append(
                ValidationRuleResult(
                    issue_type="WEAK_DESCRIPTION",
                    severity="LOW",
                    message="Description is too short or missing.",
                    suggested_fix="Add useful product details, benefits, and attributes.",
                )
            )

        # Missing important attributes
        missing_attrs = []
        if not (product.color or "").strip():
            missing_attrs.append("color")
        if not (product.size or "").strip():
            missing_attrs.append("size")
        if not (product.material or "").strip():
            missing_attrs.append("material")

        if len(missing_attrs) >= 2:
            issues.append(
                ValidationRuleResult(
                    issue_type="MISSING_IMPORTANT_ATTRIBUTES",
                    severity="MEDIUM",
                    message=f"Important attributes missing: {', '.join(missing_attrs)}.",
                    suggested_fix="Add key attributes like color, size, and material.",
                )
            )

        # Out of stock
        if (product.availability or "").strip().lower() == "out_of_stock":
            issues.append(
                ValidationRuleResult(
                    issue_type="OUT_OF_STOCK",
                    severity="LOW",
                    message="Product is marked as out of stock.",
                    suggested_fix="Restock item or hide listing to avoid poor conversion.",
                )
            )

        return issues

    def _calculate_quality_score(self, issues: List[ValidationRuleResult]) -> float:
        score = 100
        for issue in issues:
            if issue.severity == "HIGH":
                score -= self.HIGH_PENALTY
            elif issue.severity == "MEDIUM":
                score -= self.MEDIUM_PENALTY
            else:
                score -= self.LOW_PENALTY
        return float(max(0, score))

"""
services/alert_service.py

Generates actionable alerts from validation issues and pricing conditions.
F08 scope: in-app alert records only (no external notifications yet).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List

from sqlalchemy.orm import Session

from models import Alert, CompetitorPrice, Product, ProductIssue
from services.validation_service import ValidationRuleResult


@dataclass
class AlertDraft:
    alert_type: str
    severity: str
    message: str


class AlertService:
    """Builds and persists per-product alerts based on issue and price signals."""

    def sync_alerts_for_product(
        self,
        db: Session,
        product: Product,
        issues: Iterable[ValidationRuleResult] | None = None,
    ) -> List[Alert]:
        """
        Replace LISTING_QUALITY and PRICE_COMPARISON alerts for one SKU.
        Returns the final persisted alert rows.
        """
        if issues is None:
            persisted_issues = (
                db.query(ProductIssue)
                .filter(ProductIssue.sku_id == product.sku_id)
                .all()
            )
            issue_types = {i.issue_type for i in persisted_issues}
        else:
            issue_types = {self._read_issue_type(i) for i in issues if self._read_issue_type(i)}
        drafts: List[AlertDraft] = []

        # Required minimum rules from assignment spec.
        if "MISSING_TITLE" in issue_types or "INVALID_PRICE" in issue_types:
            drafts.append(
                AlertDraft(
                    alert_type="LISTING_QUALITY",
                    severity="HIGH",
                    message="Critical listing issue: missing title or invalid price.",
                )
            )

        if "VERY_SHORT_TITLE" in issue_types or "MISSING_IMPORTANT_ATTRIBUTES" in issue_types:
            drafts.append(
                AlertDraft(
                    alert_type="LISTING_QUALITY",
                    severity="MEDIUM",
                    message="Listing quality is weak: improve title or add important attributes.",
                )
            )

        if "WEAK_DESCRIPTION" in issue_types or "OUT_OF_STOCK" in issue_types:
            drafts.append(
                AlertDraft(
                    alert_type="LISTING_QUALITY",
                    severity="LOW",
                    message="Low-priority listing issue: weak description or out-of-stock status.",
                )
            )

        # High severity if our price is >10% above lowest competitor.
        competitor_rows = (
            db.query(CompetitorPrice)
            .filter(CompetitorPrice.sku_id == product.sku_id)
            .all()
        )
        if product.price is not None and competitor_rows:
            prices = [r.competitor_price for r in competitor_rows if r.competitor_price is not None and r.competitor_price > 0]
            if prices:
                lowest_competitor = min(prices)
                if product.price > lowest_competitor * 1.10:
                    drafts.append(
                        AlertDraft(
                            alert_type="PRICE_COMPARISON",
                            severity="HIGH",
                            message=(
                                f"Flipkart price is >10% higher than lowest competitor "
                                f"({product.price:.2f} vs {lowest_competitor:.2f})."
                            ),
                        )
                    )

        # Replace older listing/price alerts for this SKU to avoid duplicates.
        db.query(Alert).filter(
            Alert.sku_id == product.sku_id,
            Alert.alert_type.in_(["LISTING_QUALITY", "PRICE_COMPARISON"]),
        ).delete(synchronize_session=False)

        persisted: List[Alert] = []
        seen = set()
        for d in drafts:
            key = (d.alert_type, d.severity, d.message)
            if key in seen:
                continue
            seen.add(key)
            row = Alert(
                sku_id=product.sku_id,
                alert_type=d.alert_type,
                severity=d.severity,
                message=d.message,
                is_read=False,
            )
            db.add(row)
            persisted.append(row)

        db.commit()
        return persisted

    def _read_issue_type(self, issue: Any) -> str:
        if hasattr(issue, "issue_type"):
            return getattr(issue, "issue_type")
        if isinstance(issue, dict):
            return str(issue.get("issue_type", ""))
        return ""

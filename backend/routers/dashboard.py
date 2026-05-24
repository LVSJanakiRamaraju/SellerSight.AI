"""
routers/dashboard.py

GET /dashboard/quality-summary
Aggregates listing quality, issue severity, and alert metrics for dashboard cards/charts.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Alert, Product, ProductIssue
from schemas import QualitySummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/quality-summary", response_model=QualitySummary)
def get_quality_summary(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.sku_id)).scalar() or 0

    high_issue_count = (
        db.query(func.count(ProductIssue.id))
        .filter(ProductIssue.severity == "HIGH")
        .scalar()
        or 0
    )
    medium_issue_count = (
        db.query(func.count(ProductIssue.id))
        .filter(ProductIssue.severity == "MEDIUM")
        .scalar()
        or 0
    )
    low_issue_count = (
        db.query(func.count(ProductIssue.id))
        .filter(ProductIssue.severity == "LOW")
        .scalar()
        or 0
    )

    avg_quality_score = db.query(func.avg(Product.quality_score)).scalar()
    avg_quality_score = round(float(avg_quality_score), 2) if avg_quality_score is not None else 0.0

    missing_image_count = (
        db.query(func.count(Product.sku_id))
        .filter((Product.image_url.is_(None)) | (Product.image_url == ""))
        .scalar()
        or 0
    )

    invalid_price_count = (
        db.query(func.count(Product.sku_id))
        .filter((Product.price.is_(None)) | (Product.price <= 0))
        .scalar()
        or 0
    )

    out_of_stock_count = (
        db.query(func.count(Product.sku_id))
        .filter(Product.availability == "out_of_stock")
        .scalar()
        or 0
    )

    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    unread_alerts = db.query(func.count(Alert.id)).filter(Alert.is_read.is_(False)).scalar() or 0

    products_with_issues = db.query(func.count(func.distinct(ProductIssue.sku_id))).scalar() or 0
    no_issue_count = max(total_products - products_with_issues, 0)

    grouped = (
        db.query(
            ProductIssue.issue_type,
            ProductIssue.severity,
            func.count(ProductIssue.id).label("count"),
        )
        .group_by(ProductIssue.issue_type, ProductIssue.severity)
        .order_by(func.count(ProductIssue.id).desc())
        .all()
    )

    issue_breakdown = [
        {
            "issue_type": issue_type,
            "severity": severity,
            "count": count,
        }
        for issue_type, severity, count in grouped
    ]

    return QualitySummary(
        total_products=total_products,
        high_issue_count=high_issue_count,
        medium_issue_count=medium_issue_count,
        low_issue_count=low_issue_count,
        no_issue_count=no_issue_count,
        avg_quality_score=avg_quality_score,
        missing_image_count=missing_image_count,
        invalid_price_count=invalid_price_count,
        out_of_stock_count=out_of_stock_count,
        total_alerts=total_alerts,
        unread_alerts=unread_alerts,
        issue_breakdown=issue_breakdown,
    )

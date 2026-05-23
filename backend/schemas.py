"""
schemas.py — Pydantic v2 request/response models for all API endpoints.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Job ───────────────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: str
    job_type: str
    status: str
    progress: int
    total_items: int
    processed_items: int
    failed_items: int
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
    result_summary: Optional[str]

    model_config = {"from_attributes": True}


# ── ProductIssue ──────────────────────────────────────────────────────────────

class ProductIssueOut(BaseModel):
    id: int
    sku_id: str
    issue_type: str
    severity: str
    message: str
    suggested_fix: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── CompetitorPrice ───────────────────────────────────────────────────────────

class CompetitorPriceOut(BaseModel):
    id: int
    sku_id: str
    product_name: Optional[str]
    platform: str
    competitor_url: Optional[str]
    competitor_price: float
    currency: str
    last_checked_at: datetime
    price_history: Optional[str]

    model_config = {"from_attributes": True}


# ── Alert ─────────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: int
    sku_id: Optional[str]
    alert_type: str
    severity: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertMarkRead(BaseModel):
    ids: List[int]


# ── Product ───────────────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    sku_id: str
    product_title: Optional[str]
    brand: Optional[str]
    category: Optional[str]
    price: Optional[float]
    mrp: Optional[float]
    description: Optional[str]
    image_url: Optional[str]
    product_url: Optional[str]
    availability: Optional[str]
    color: Optional[str]
    size: Optional[str]
    material: Optional[str]
    job_id: Optional[str]
    enhance_title: bool
    enhanced_title: Optional[str]
    title_keywords: Optional[str]
    title_attributes: Optional[str]
    title_enhancement_reason: Optional[str]
    quality_score: Optional[float]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductDetailOut(ProductOut):
    issues: List[ProductIssueOut] = []
    competitor_prices: List[CompetitorPriceOut] = []
    alerts: List[AlertOut] = []


class ProductUpdate(BaseModel):
    product_title: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    mrp: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    product_url: Optional[str] = None
    availability: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    enhance_title: Optional[bool] = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

class QualitySummary(BaseModel):
    total_products: int
    high_issue_count: int
    medium_issue_count: int
    low_issue_count: int
    no_issue_count: int
    avg_quality_score: float
    missing_image_count: int
    invalid_price_count: int
    out_of_stock_count: int
    total_alerts: int
    unread_alerts: int
    issue_breakdown: List[dict]


# ── Price Comparison ──────────────────────────────────────────────────────────

class PriceComparisonOut(BaseModel):
    sku_id: str
    product_title: Optional[str]
    our_price: Optional[float]
    lowest_competitor_price: Optional[float]
    highest_competitor_price: Optional[float]
    avg_competitor_price: Optional[float]
    price_gap: Optional[float]
    percentage_diff: Optional[float]
    recommended_action: str
    competitor_prices: List[CompetitorPriceOut] = []


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    job_id: str
    message: str
    status: str

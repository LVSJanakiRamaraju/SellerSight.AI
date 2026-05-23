"""
models.py — SQLAlchemy ORM models for SellerSight.AI.

Entities
--------
  Job             — tracks long-running background tasks
  Product         — a seller SKU on Flipkart
  ProductIssue    — a single listing-quality issue found during validation
  CompetitorPrice — a price data point from a competitor platform
  Alert           — an actionable notification raised by the system
"""
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    DateTime, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid


# ── Job ───────────────────────────────────────────────────────────────────────

class Job(Base):
    """
    Tracks every async operation: video processing, CSV import, price refresh.

    Status lifecycle:
        PENDING → RUNNING → COMPLETED
                          → FAILED
                          → PARTIALLY_COMPLETED  (some rows failed in CSV)
    """
    __tablename__ = "jobs"

    id               = Column(String,  primary_key=True, default=lambda: str(uuid.uuid4()))
    job_type         = Column(String,  nullable=False)   # video_upload | csv_upload | price_refresh
    status           = Column(String,  default="PENDING")
    progress         = Column(Integer, default=0)        # 0 – 100
    total_items      = Column(Integer, default=0)
    processed_items  = Column(Integer, default=0)
    failed_items     = Column(Integer, default=0)
    started_at       = Column(DateTime, default=func.now())
    completed_at     = Column(DateTime, nullable=True)
    error_message    = Column(Text,   nullable=True)
    result_summary   = Column(Text,   nullable=True)     # JSON blob

    products = relationship("Product", back_populates="job", lazy="dynamic")


# ── Product ───────────────────────────────────────────────────────────────────

class Product(Base):
    """
    One seller SKU.  Populated from a video upload, CSV row, or manual edit.
    """
    __tablename__ = "products"

    sku_id        = Column(String, primary_key=True)
    product_title = Column(String, nullable=True)
    brand         = Column(String, nullable=True)
    category      = Column(String, nullable=True)
    price         = Column(Float,  nullable=True)   # Flipkart selling price (INR)
    mrp           = Column(Float,  nullable=True)
    description   = Column(Text,   nullable=True)
    image_url     = Column(String, nullable=True)
    product_url   = Column(String, nullable=True)
    availability  = Column(String, default="in_stock")   # in_stock | out_of_stock
    color         = Column(String, nullable=True)
    size          = Column(String, nullable=True)
    material      = Column(String, nullable=True)

    # Processing metadata
    job_id        = Column(String, ForeignKey("jobs.id"), nullable=True)
    enhance_title = Column(Boolean, default=False)

    # Title-enhancement outputs
    enhanced_title            = Column(Text, nullable=True)
    title_keywords            = Column(Text, nullable=True)  # JSON array
    title_attributes          = Column(Text, nullable=True)  # JSON object
    title_enhancement_reason  = Column(Text, nullable=True)

    quality_score = Column(Float, nullable=True)   # 0 – 100
    created_at    = Column(DateTime, default=func.now())
    updated_at    = Column(DateTime, default=func.now(), onupdate=func.now())

    job              = relationship("Job",             back_populates="products")
    issues           = relationship("ProductIssue",    back_populates="product", cascade="all, delete-orphan")
    competitor_prices= relationship("CompetitorPrice", back_populates="product", cascade="all, delete-orphan")
    alerts           = relationship("Alert",           back_populates="product")


# ── ProductIssue ──────────────────────────────────────────────────────────────

class ProductIssue(Base):
    """
    One listing-quality issue detected by the validation service.
    Severity: HIGH | MEDIUM | LOW
    """
    __tablename__ = "product_issues"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    sku_id        = Column(String, ForeignKey("products.sku_id"), nullable=False)
    issue_type    = Column(String, nullable=False)
    severity      = Column(String, nullable=False)   # HIGH | MEDIUM | LOW
    message       = Column(Text,   nullable=False)
    suggested_fix = Column(Text,   nullable=True)
    created_at    = Column(DateTime, default=func.now())

    product = relationship("Product", back_populates="issues")


# ── CompetitorPrice ───────────────────────────────────────────────────────────

class CompetitorPrice(Base):
    """
    A price record for a SKU on a competitor platform (Amazon, Myntra, etc.).
    price_history stores a JSON array of {price, checked_at} for trend charts.
    """
    __tablename__ = "competitor_prices"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    sku_id           = Column(String, ForeignKey("products.sku_id"), nullable=False)
    product_name     = Column(String, nullable=True)
    platform         = Column(String, nullable=False)
    competitor_url   = Column(String, nullable=True)
    competitor_price = Column(Float,  nullable=False)
    currency         = Column(String, default="INR")
    last_checked_at  = Column(DateTime, default=func.now())
    price_history    = Column(Text, nullable=True)   # JSON: [{price, checked_at}, ...]

    product = relationship("Product", back_populates="competitor_prices")


# ── Alert ─────────────────────────────────────────────────────────────────────

class Alert(Base):
    """
    Actionable notification raised by the validation or pricing engine.
    Types: LISTING_QUALITY | PRICE_COMPARISON | PRICE_DROP
    """
    __tablename__ = "alerts"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    sku_id     = Column(String, ForeignKey("products.sku_id"), nullable=True)
    alert_type = Column(String, nullable=False)
    severity   = Column(String, nullable=False)   # HIGH | MEDIUM | LOW
    message    = Column(Text,   nullable=False)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    product = relationship("Product", back_populates="alerts")

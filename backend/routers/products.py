"""
routers/products.py — Product read & update endpoints.

GET   /products                   — list all products (with optional filters)
GET   /products/{sku_id}          — product detail (with issues, prices, alerts)
PATCH /products/{sku_id}          — update product fields manually
GET   /products/{sku_id}/issues   — list issues for one product
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database import get_db
from models import Product, ProductIssue
from schemas import ProductOut, ProductDetailOut, ProductUpdate, ProductIssueOut
from services.validation_service import ListingValidator

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=List[ProductOut])
def list_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    severity: Optional[str] = Query(None, description="Filter by highest issue severity: HIGH | MEDIUM | LOW"),
    availability: Optional[str] = Query(None, description="in_stock | out_of_stock"),
    search: Optional[str] = Query(None, description="Search by title or SKU"),
    db: Session = Depends(get_db),
):
    """
    List all products with optional filters.
    severity filter returns products that have AT LEAST ONE issue of that severity.
    """
    query = db.query(Product)

    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))
    if availability:
        query = query.filter(Product.availability == availability)
    if search:
        query = query.filter(
            (Product.sku_id.ilike(f"%{search}%")) |
            (Product.product_title.ilike(f"%{search}%"))
        )
    if severity:
        query = query.join(ProductIssue).filter(ProductIssue.severity == severity.upper())

    return query.order_by(Product.created_at.desc()).all()


@router.get("/{sku_id}", response_model=ProductDetailOut)
def get_product(sku_id: str, db: Session = Depends(get_db)):
    """Return a product with all its issues, competitor prices, and alerts."""
    product = (
        db.query(Product)
        .options(
            joinedload(Product.issues),
            joinedload(Product.competitor_prices),
            joinedload(Product.alerts),
        )
        .filter(Product.sku_id == sku_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")
    return product


@router.patch("/{sku_id}", response_model=ProductOut)
def update_product(sku_id: str, payload: ProductUpdate, db: Session = Depends(get_db)):
    """
    Partial update of product fields (e.g. after user manually edits extracted data).
    Only supplied fields are updated.
    """
    product = db.query(Product).filter(Product.sku_id == sku_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    db.commit()
    validator = ListingValidator()
    validator.validate_and_persist(db, product)
    db.refresh(product)
    return product


@router.get("/{sku_id}/issues", response_model=List[ProductIssueOut])
def get_product_issues(sku_id: str, db: Session = Depends(get_db)):
    """Return all validation issues for a specific product."""
    if not db.query(Product).filter(Product.sku_id == sku_id).first():
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")
    return (
        db.query(ProductIssue)
        .filter(ProductIssue.sku_id == sku_id)
        .order_by(ProductIssue.severity)
        .all()
    )

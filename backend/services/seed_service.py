"""
services/seed_service.py

Seeds demo data for first-run reviewer experience.
Runs once when database has no products.
"""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from models import CompetitorPrice, Product
from services.alert_service import AlertService
from services.title_service import TitleEnhancer
from services.validation_service import ListingValidator


_DEMO_PRODUCTS = [
    {
        "sku_id": "SHOE001",
        "product_title": "Nike Blue Running Shoes",
        "brand": "Nike",
        "category": "Running Shoes",
        "price": 3999.0,
        "mrp": 4999.0,
        "description": "Lightweight running shoes with breathable mesh upper and responsive sole for daily training and comfort.",
        "image_url": "https://example.com/images/shoe001.jpg",
        "product_url": "https://flipkart.example.com/shoe001",
        "availability": "in_stock",
        "color": "Blue",
        "size": "9",
        "material": "Mesh",
        "enhance_title": True,
    },
    {
        "sku_id": "DRESS001",
        "product_title": "Red Dress",
        "brand": "Zara",
        "category": "Dresses",
        "price": 1799.0,
        "mrp": 2499.0,
        "description": "Elegant red dress with soft lining, tailored fit, and comfortable all-day wear.",
        "image_url": "https://example.com/images/dress001.jpg",
        "product_url": "https://flipkart.example.com/dress001",
        "availability": "in_stock",
        "color": "Red",
        "size": "M",
        "material": "Polyester",
        "enhance_title": True,
    },
    {
        "sku_id": "BAG001",
        "product_title": "Travel Bag",
        "brand": "Puma",
        "category": "Bags",
        "price": 0.0,
        "mrp": 1299.0,
        "description": "Compact bag.",
        "image_url": "",
        "product_url": "https://flipkart.example.com/bag001",
        "availability": "out_of_stock",
        "color": "",
        "size": "",
        "material": "",
        "enhance_title": False,
    },
    {
        "sku_id": "WATCH001",
        "product_title": "Titan",
        "brand": "Titan",
        "category": "Watches",
        "price": 5499.0,
        "mrp": 4999.0,
        "description": "Premium dial watch with stainless steel body and durable strap for formal and daily use.",
        "image_url": "bad-url",
        "product_url": "https://flipkart.example.com/watch001",
        "availability": "in_stock",
        "color": "Black",
        "size": "",
        "material": "Steel",
        "enhance_title": True,
    },
    {
        "sku_id": "TSHIRT001",
        "product_title": "Levis White Casual T-Shirt for Men",
        "brand": "Levis",
        "category": "T-Shirts",
        "price": 999.0,
        "mrp": 1499.0,
        "description": "Soft cotton t-shirt with breathable texture and regular fit for casual wear.",
        "image_url": "https://example.com/images/tshirt001.jpg",
        "product_url": "https://flipkart.example.com/tshirt001",
        "availability": "in_stock",
        "color": "White",
        "size": "L",
        "material": "Cotton",
        "enhance_title": False,
    },
    {
        "sku_id": "KURTI001",
        "product_title": "Blue Kurti",
        "brand": "",
        "category": "Kurtis",
        "price": 1299.0,
        "mrp": 1599.0,
        "description": "Comfort fit kurti for daily ethnic wear with quality stitching.",
        "image_url": "https://example.com/images/kurti001.jpg",
        "product_url": "https://flipkart.example.com/kurti001",
        "availability": "in_stock",
        "color": "Blue",
        "size": "M",
        "material": "Rayon",
        "enhance_title": True,
    },
    {
        "sku_id": "LAPTOPBAG001",
        "product_title": "Laptop Bag 15 inch",
        "brand": "Skybags",
        "category": "Laptop Bags",
        "price": 2199.0,
        "mrp": 2899.0,
        "description": "Durable laptop bag with padded compartment and organizer pockets.",
        "image_url": "https://example.com/images/laptopbag001.jpg",
        "product_url": "https://flipkart.example.com/laptopbag001",
        "availability": "in_stock",
        "color": "Grey",
        "size": "15 inch",
        "material": "Nylon",
        "enhance_title": False,
    },
    {
        "sku_id": "SHOE002",
        "product_title": "Adidas Black Sports Shoes for Men",
        "brand": "Adidas",
        "category": "Sports Shoes",
        "price": 3499.0,
        "mrp": 4499.0,
        "description": "Sports shoes with durable sole and breathable upper built for active movement.",
        "image_url": "https://example.com/images/shoe002.jpg",
        "product_url": "https://flipkart.example.com/shoe002",
        "availability": "in_stock",
        "color": "Black",
        "size": "10",
        "material": "Mesh",
        "enhance_title": True,
    },
]


_DEMO_COMPETITOR_PRICES = [
    ("SHOE001", "Amazon", 3499.0),
    ("SHOE001", "Myntra", 3799.0),
    ("DRESS001", "Ajio", 1599.0),
    ("DRESS001", "Nykaa Fashion", 1899.0),
    ("WATCH001", "Amazon", 4499.0),
    ("WATCH001", "Tata Cliq", 4699.0),
    ("SHOE002", "Amazon", 3199.0),
    ("SHOE002", "Meesho", 3399.0),
]


def seed_demo_data(db: Session) -> bool:
    """
    Seed demo records only when the products table is empty.
    Returns True if seed was applied, False otherwise.
    """
    existing_count = db.query(Product).count()
    if existing_count > 0:
        return False

    validator = ListingValidator()
    enhancer = TitleEnhancer()
    alert_service = AlertService()

    # Seed products
    for data in _DEMO_PRODUCTS:
        p = Product(**data)
        db.add(p)
    db.commit()

    # Apply enrichment + validation + listing alerts
    products = db.query(Product).all()
    for p in products:
        if p.enhance_title:
            enhancer.enhance_and_persist(db, p)
        issues = validator.validate_and_persist(db, p)
        alert_service.sync_alerts_for_product(db, p, issues)

    # Seed competitor prices
    for sku_id, platform, price in _DEMO_COMPETITOR_PRICES:
        history = json.dumps([
            {"price": price, "checked_at": datetime.utcnow().isoformat()}
        ])
        row = CompetitorPrice(
            sku_id=sku_id,
            product_name=None,
            platform=platform,
            competitor_url=f"https://example.com/{sku_id.lower()}/{platform.lower().replace(' ', '-')}",
            competitor_price=price,
            currency="INR",
            last_checked_at=datetime.utcnow(),
            price_history=history,
        )
        db.add(row)
    db.commit()

    # Re-sync alerts so price-comparison HIGH alerts are included.
    for p in db.query(Product).all():
        alert_service.sync_alerts_for_product(db, p)

    return True

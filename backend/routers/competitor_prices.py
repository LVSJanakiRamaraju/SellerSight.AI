"""
routers/competitor_prices.py

POST /competitor-prices/upload            - ingest competitor CSV data
POST /competitor-prices/refresh           - simulate competitor price refresh (async job)
GET  /products/{sku_id}/competitor-prices - price comparison for one product
"""
from __future__ import annotations

import csv
import io
import json
import random
import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Alert, CompetitorPrice, Job, Product
from schemas import CompetitorPriceOut, PriceComparisonOut, UploadResponse
from services.alert_service import AlertService

router = APIRouter(tags=["Competitor Prices"])


def _to_float(value: str | None) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _append_history(existing: str | None, price: float) -> str:
    history = []
    if existing:
        try:
            history = json.loads(existing)
        except json.JSONDecodeError:
            history = []

    history.append({"price": price, "checked_at": datetime.utcnow().isoformat()})
    return json.dumps(history)


def _upsert_competitor_price(
    db: Session,
    sku_id: str,
    platform: str,
    competitor_price: float,
    product_name: Optional[str] = None,
    competitor_url: Optional[str] = None,
    currency: str = "INR",
) -> CompetitorPrice:
    row = (
        db.query(CompetitorPrice)
        .filter(CompetitorPrice.sku_id == sku_id, CompetitorPrice.platform == platform)
        .first()
    )

    if row:
        row.competitor_price = competitor_price
        row.product_name = product_name or row.product_name
        row.competitor_url = competitor_url or row.competitor_url
        row.currency = currency or row.currency
        row.last_checked_at = datetime.utcnow()
        row.price_history = _append_history(row.price_history, competitor_price)
        db.commit()
        db.refresh(row)
        return row

    row = CompetitorPrice(
        sku_id=sku_id,
        platform=platform,
        competitor_price=competitor_price,
        product_name=product_name,
        competitor_url=competitor_url,
        currency=currency or "INR",
        last_checked_at=datetime.utcnow(),
        price_history=json.dumps([
            {"price": competitor_price, "checked_at": datetime.utcnow().isoformat()}
        ]),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _recommended_action(our_price: Optional[float], lowest: Optional[float]) -> str:
    if our_price is None:
        return "Set Flipkart selling price first."
    if lowest is None:
        return "Add competitor prices to compare and optimize pricing."
    if our_price > lowest * 1.10:
        return "Reduce Flipkart price or add value proposition; currently uncompetitive."
    if our_price < lowest * 0.85:
        return "Consider increasing margin; Flipkart price is significantly lower than competitors."
    return "Price is competitive. Monitor refresh trends regularly."


def _build_price_comparison(product: Product, rows: list[CompetitorPrice]) -> PriceComparisonOut:
    prices = [r.competitor_price for r in rows if r.competitor_price is not None]
    lowest = min(prices) if prices else None
    highest = max(prices) if prices else None
    avg = round(sum(prices) / len(prices), 2) if prices else None

    our_price = product.price
    gap = None
    pct = None
    if our_price is not None and lowest is not None:
        gap = round(our_price - lowest, 2)
        pct = round(((our_price - lowest) / lowest) * 100, 2) if lowest else None

    return PriceComparisonOut(
        sku_id=product.sku_id,
        product_title=product.product_title,
        our_price=our_price,
        lowest_competitor_price=lowest,
        highest_competitor_price=highest,
        avg_competitor_price=avg,
        price_gap=gap,
        percentage_diff=pct,
        recommended_action=_recommended_action(our_price, lowest),
        competitor_prices=rows,
    )


def _process_refresh_job(job_id: str, sku_id: Optional[str]):
    db = SessionLocal()
    alert_service = AlertService()

    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = "RUNNING"
        db.commit()

        query = db.query(CompetitorPrice)
        if sku_id:
            query = query.filter(CompetitorPrice.sku_id == sku_id)

        rows = query.all()
        total = len(rows)
        job.total_items = total
        db.commit()

        if total == 0:
            job.status = "COMPLETED"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            job.result_summary = '{"refreshed":0,"price_drop_alerts":0}'
            db.commit()
            return

        processed = 0
        drop_alerts = 0

        for row in rows:
            old = row.competitor_price
            # Simulate market movement: -15% to +8%
            factor = random.uniform(0.85, 1.08)
            new_price = round(max(1.0, old * factor), 2)

            row.competitor_price = new_price
            row.last_checked_at = datetime.utcnow()
            row.price_history = _append_history(row.price_history, new_price)
            db.commit()

            # Medium alert if competitor dropped significantly (>=10%).
            if old > 0:
                drop_pct = ((old - new_price) / old) * 100
                if drop_pct >= 10:
                    db.add(
                        Alert(
                            sku_id=row.sku_id,
                            alert_type="PRICE_DROP",
                            severity="MEDIUM",
                            message=(
                                f"{row.platform} price dropped by {drop_pct:.2f}% for {row.sku_id} "
                                f"({old:.2f} -> {new_price:.2f})."
                            ),
                            is_read=False,
                        )
                    )
                    db.commit()
                    drop_alerts += 1

            product = db.query(Product).filter(Product.sku_id == row.sku_id).first()
            if product:
                alert_service.sync_alerts_for_product(db, product)

            processed += 1
            job.processed_items = processed
            job.progress = int((processed / total) * 100)
            db.commit()

        job.status = "COMPLETED"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        job.result_summary = f'{{"refreshed":{processed},"price_drop_alerts":{drop_alerts}}}'
        db.commit()

    except Exception as exc:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(exc)
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.post("/competitor-prices/upload")
async def upload_competitor_prices_csv(
    file: UploadFile = File(..., description="Competitor price CSV"),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers.")

    ingested = skipped = 0
    alert_service = AlertService()

    for raw in reader:
        sku = (raw.get("sku_id") or "").strip()
        platform = (raw.get("platform") or "").strip()
        price = _to_float(raw.get("competitor_price"))

        if not sku or not platform or price is None or price <= 0:
            skipped += 1
            continue

        product = db.query(Product).filter(Product.sku_id == sku).first()
        if not product:
            skipped += 1
            continue

        _upsert_competitor_price(
            db=db,
            sku_id=sku,
            platform=platform,
            competitor_price=price,
            product_name=raw.get("product_name"),
            competitor_url=raw.get("competitor_url"),
            currency=(raw.get("currency") or "INR"),
        )

        alert_service.sync_alerts_for_product(db, product)
        ingested += 1

    return {"message": "Competitor prices processed.", "ingested": ingested, "skipped": skipped}


@router.post("/competitor-prices/refresh", response_model=UploadResponse, status_code=202)
def refresh_competitor_prices(
    sku_id: Optional[str] = Form(None, description="Optional SKU to refresh only one product"),
    db: Session = Depends(get_db),
):
    if sku_id and not db.query(Product).filter(Product.sku_id == sku_id).first():
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")

    job = Job(job_type="price_refresh")
    db.add(job)
    db.commit()
    db.refresh(job)

    t = threading.Thread(target=_process_refresh_job, args=(job.id, sku_id), daemon=True)
    t.start()

    return UploadResponse(
        job_id=job.id,
        message="Competitor price refresh started.",
        status="PENDING",
    )


@router.get("/products/{sku_id}/competitor-prices", response_model=PriceComparisonOut)
def get_product_competitor_prices(sku_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.sku_id == sku_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")

    rows = (
        db.query(CompetitorPrice)
        .filter(CompetitorPrice.sku_id == sku_id)
        .order_by(CompetitorPrice.last_checked_at.desc())
        .all()
    )

    return _build_price_comparison(product, rows)


@router.get("/competitor-prices/{sku_id}", response_model=list[CompetitorPriceOut])
def get_competitor_price_rows(sku_id: str, db: Session = Depends(get_db)):
    if not db.query(Product).filter(Product.sku_id == sku_id).first():
        raise HTTPException(status_code=404, detail=f"Product '{sku_id}' not found.")

    return (
        db.query(CompetitorPrice)
        .filter(CompetitorPrice.sku_id == sku_id)
        .order_by(CompetitorPrice.last_checked_at.desc())
        .all()
    )

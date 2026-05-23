"""
routers/upload.py — File upload endpoints.

POST /upload-products-csv  — parse a product CSV, create a job, process in background
POST /upload-video         — accept a product video, create a job, mock-extract in background
"""
import csv
import io
import os
import uuid
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import Job, Product
from schemas import UploadResponse
from services.alert_service import AlertService
from services.title_service import TitleEnhancer
from services.validation_service import ListingValidator
from services.video_extraction_service import MockVideoExtractor

router = APIRouter(tags=["Upload"])

# ── CSV column aliases (normalise different header spellings) ─────────────────
_COL_MAP = {
    "sku": "sku_id", "id": "sku_id", "product_id": "sku_id",
    "title": "product_title", "name": "product_title",
    "price": "price", "selling_price": "price",
    "mrp": "mrp", "market_price": "mrp",
    "desc": "description", "product_description": "description",
    "img": "image_url", "image": "image_url",
    "url": "product_url",
    "stock": "availability", "in_stock": "availability",
}

_VALID_COLS = {
    "sku_id", "product_title", "brand", "category",
    "price", "mrp", "description", "image_url", "product_url",
    "availability", "color", "size", "material",
}

_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def _safe_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ("-", "_", ".")).strip(".") or "upload.mp4"


def _uploads_dir() -> Path:
    # backend/routers/upload.py -> backend/uploads
    base = Path(__file__).resolve().parents[1] / "uploads"
    base.mkdir(parents=True, exist_ok=True)
    return base


def _normalise_header(h: str) -> str:
    h = h.strip().lower()
    return _COL_MAP.get(h, h)


def _to_float(val: str) -> Optional[float]:
    try:
        return float(val.strip())
    except (ValueError, AttributeError):
        return None


# ── Background worker — CSV processing ───────────────────────────────────────

def _process_csv_job(job_id: str, rows: list[dict], enhance_title: bool):
    """
    Runs in a daemon thread.
    Parses each CSV row into a Product, deduplicates SKUs, tracks progress.
    Validation and alerts are wired in F07 / F08.
    """
    db = SessionLocal()
    seen_skus: set[str] = set()
    validator = ListingValidator()
    alert_service = AlertService()
    title_enhancer = TitleEnhancer()

    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        job.status = "RUNNING"
        job.total_items = len(rows)
        db.commit()

        processed = failed = 0
        total_detected_issues = 0

        for i, row in enumerate(rows):
            try:
                sku_id = row.get("sku_id", "").strip()
                if not sku_id:
                    sku_id = f"AUTO-{uuid.uuid4().hex[:8].upper()}"

                # Duplicate SKU in same upload → flag but still process
                duplicate_sku_in_batch = sku_id in seen_skus
                if duplicate_sku_in_batch:
                    sku_id = f"{sku_id}-DUP-{uuid.uuid4().hex[:4].upper()}"
                seen_skus.add(sku_id)

                # Upsert: if SKU already exists, overwrite
                existing = db.query(Product).filter(Product.sku_id == sku_id).first()
                if existing:
                    db.delete(existing)
                    db.commit()

                product = Product(
                    sku_id=sku_id,
                    product_title=row.get("product_title") or None,
                    brand=row.get("brand") or None,
                    category=row.get("category") or None,
                    price=_to_float(row.get("price", "")),
                    mrp=_to_float(row.get("mrp", "")),
                    description=row.get("description") or None,
                    image_url=row.get("image_url") or None,
                    product_url=row.get("product_url") or None,
                    availability=row.get("availability") or "in_stock",
                    color=row.get("color") or None,
                    size=row.get("size") or None,
                    material=row.get("material") or None,
                    job_id=job_id,
                    enhance_title=enhance_title,
                )
                db.add(product)
                db.commit()

                if enhance_title:
                    title_enhancer.enhance_and_persist(db, product)

                issues = validator.validate_and_persist(
                    db,
                    product,
                    duplicate_sku=duplicate_sku_in_batch,
                )
                alert_service.sync_alerts_for_product(db, product, issues)
                total_detected_issues += len(issues)
                processed += 1

            except Exception:
                failed += 1

            # Update progress (10 % base + 80 % for rows + 10 % reserved for post-processing)
            progress = 10 + int((i + 1) / len(rows) * 80)
            job.progress = progress
            job.processed_items = processed
            job.failed_items = failed
            db.commit()

            time.sleep(0.05)   # simulate realistic processing time

        # Mark complete (validation hook added in F07)
        job.status = "COMPLETED" if failed == 0 else "PARTIALLY_COMPLETED"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        job.result_summary = (
            f'{{"processed": {processed}, "failed": {failed}, "total": {len(rows)}, "issues_detected": {total_detected_issues}}}'
        )
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


def _process_video_job(job_id: str, saved_path: str, original_filename: str, enhance_title: bool):
    """
    Simulates video processing stages and creates one extracted product record.
    """
    db = SessionLocal()
    validator = ListingValidator()
    alert_service = AlertService()
    title_enhancer = TitleEnhancer()
    extractor = MockVideoExtractor()

    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = "RUNNING"
        job.total_items = 1
        job.progress = 5
        db.commit()

        # Stage 1: frame extraction (simulated)
        time.sleep(0.2)
        job.progress = 25
        db.commit()

        # Stage 2: OCR/analysis (simulated)
        extraction = extractor.extract(original_filename)
        time.sleep(0.2)
        job.progress = 55
        db.commit()

        # Stage 3: create product record
        sku_id = f"VID-{uuid.uuid4().hex[:8].upper()}"
        product = Product(
            sku_id=sku_id,
            product_title=extraction.product_title,
            brand=extraction.brand,
            category=extraction.category,
            price=extraction.price,
            mrp=extraction.mrp,
            description=extraction.description,
            image_url=None,
            product_url=None,
            availability="in_stock",
            color=extraction.color,
            size=None,
            material=extraction.material,
            job_id=job_id,
            enhance_title=enhance_title,
        )
        db.add(product)
        db.commit()
        job.progress = 75
        db.commit()

        if enhance_title:
            title_enhancer.enhance_and_persist(db, product)

        issues = validator.validate_and_persist(db, product)
        alert_service.sync_alerts_for_product(db, product, issues)

        # Stage 4: finalize
        job.progress = 100
        job.status = "PARTIALLY_COMPLETED" if extraction.missing_fields else "COMPLETED"
        job.processed_items = 1
        job.completed_at = datetime.utcnow()
        job.result_summary = (
            f'{{"source":"video","file":"{os.path.basename(saved_path)}","sku_id":"{sku_id}",' \
            f'"missing_fields":{len(extraction.missing_fields)},"issues_detected":{len(issues)}}}'
        )
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


# ── Endpoint — CSV upload ─────────────────────────────────────────────────────

@router.post("/upload-products-csv", response_model=UploadResponse, status_code=202)
async def upload_products_csv(
    file: UploadFile = File(..., description="Product feed CSV"),
    enhance_title: bool = Form(False, description="Run title enhancement after import"),
    db: Session = Depends(get_db),
):
    """
    Upload a product feed CSV.
    Returns a job_id immediately; processing happens in a background thread.
    Poll GET /jobs/{job_id} for progress.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")   # handle BOM from Excel exports
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers.")

    # Normalise headers
    normalised_rows = []
    for raw_row in reader:
        row = {_normalise_header(k): v for k, v in raw_row.items()}
        normalised_rows.append(row)

    if not normalised_rows:
        raise HTTPException(status_code=400, detail="CSV has headers but no data rows.")

    # Create job
    job = Job(job_type="csv_upload")
    db.add(job)
    db.commit()
    db.refresh(job)

    # Spawn background thread
    t = threading.Thread(
        target=_process_csv_job,
        args=(job.id, normalised_rows, enhance_title),
        daemon=True,
    )
    t.start()

    return UploadResponse(
        job_id=job.id,
        message=f"CSV upload started. {len(normalised_rows)} rows queued for processing.",
        status="PENDING",
    )


@router.post("/upload-video", response_model=UploadResponse, status_code=202)
async def upload_video(
    file: UploadFile = File(..., description="Short product video"),
    enhance_title: bool = Form(False, description="Enable title enhancement"),
    db: Session = Depends(get_db),
):
    """
    Upload a product video and start background extraction job.
    Extraction is mocked for assignment reliability and speed.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _VIDEO_EXTS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format. Use mp4/mov/avi/mkv/webm.",
        )

    safe_name = _safe_filename(file.filename or f"upload{ext}")
    saved_name = f"{uuid.uuid4().hex[:12]}-{safe_name}"
    saved_path = _uploads_dir() / saved_name

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    job = Job(job_type="video_upload")
    db.add(job)
    db.commit()
    db.refresh(job)

    t = threading.Thread(
        target=_process_video_job,
        args=(job.id, str(saved_path), file.filename or saved_name, enhance_title),
        daemon=True,
    )
    t.start()

    return UploadResponse(
        job_id=job.id,
        message="Video upload accepted. Extraction job started.",
        status="PENDING",
    )

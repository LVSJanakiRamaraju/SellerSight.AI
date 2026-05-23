"""
routers/alerts.py

GET   /alerts            - list alerts with filters
POST  /alerts/mark-read  - mark selected alerts as read
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Alert
from schemas import AlertMarkRead, AlertOut

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertOut])
def list_alerts(
    severity: Optional[str] = Query(None, description="HIGH | MEDIUM | LOW"),
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    sku_id: Optional[str] = Query(None, description="Filter by SKU"),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    if is_read is not None:
        query = query.filter(Alert.is_read == is_read)
    if sku_id:
        query = query.filter(Alert.sku_id == sku_id)

    return query.order_by(Alert.created_at.desc(), Alert.id.desc()).all()


@router.post("/mark-read", response_model=List[AlertOut])
def mark_alerts_read(payload: AlertMarkRead, db: Session = Depends(get_db)):
    if payload.ids:
        db.query(Alert).filter(Alert.id.in_(payload.ids)).update(
            {Alert.is_read: True},
            synchronize_session=False,
        )
        db.commit()

    return (
        db.query(Alert)
        .filter(Alert.id.in_(payload.ids))
        .order_by(Alert.created_at.desc(), Alert.id.desc())
        .all()
    )

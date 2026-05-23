"""
routers/jobs.py — Job status & listing endpoints.

GET  /jobs           — list all jobs (newest first)
GET  /jobs/{job_id}  — get single job with progress
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Job
from schemas import JobOut

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("", response_model=List[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    """Return all jobs ordered by most recent first."""
    return db.query(Job).order_by(Job.started_at.desc()).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    """Return a single job by ID. Used by the frontend for progress polling."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job

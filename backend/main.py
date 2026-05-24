"""
main.py — FastAPI application entry point.

Routers are registered here as features are added (F04 onwards).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import jobs, products, upload, alerts, competitor_prices, dashboard

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SellerSight.AI API",
    description=(
        "Product Intelligence Dashboard for E-commerce Sellers. "
        "Validates listings, compares competitor prices, and raises actionable alerts."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tightened in production via env var
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────

app.include_router(jobs.router)
app.include_router(products.router)
app.include_router(upload.router)
app.include_router(alerts.router)
app.include_router(competitor_prices.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["System"])
def health():
    """Liveness probe — used by Render / Kubernetes."""
    return {"status": "ok", "service": "SellerSight.AI"}


@app.get("/", tags=["System"])
def root():
    return {"message": "SellerSight.AI API is running. Visit /docs for the API reference."}

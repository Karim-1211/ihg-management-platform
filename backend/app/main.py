import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import (
    auth, hotels, bookings, service_requests, billing, audit,
    restaurants, reservations, orders, restaurant_billing, delivery, inventory,
    notifications, dashboard, reports, business_rules, ai_customer_assistant, ai_staff_assistant,
    booking_import,
)

# Phase 24.2: fail loudly at startup, not silently at request time, if a
# production deployment is missing required configuration. Development is
# unaffected — this check is a no-op unless APP_ENV=production.
_production_problems = settings.validate_production_readiness()
if _production_problems:
    print("FATAL: production configuration problems detected:", file=sys.stderr)
    for problem in _production_problems:
        print(f"  - {problem}", file=sys.stderr)
    sys.exit(1)

app = FastAPI(
    title="IHG Management Platform API",
    version="1.0.0",
    description="Enterprise Hospitality, Restaurant & Food Delivery Management Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(hotels.router)
app.include_router(bookings.router)
app.include_router(service_requests.router)
app.include_router(billing.router)
app.include_router(audit.router)
app.include_router(restaurants.router)
app.include_router(reservations.router)
app.include_router(orders.router)
app.include_router(restaurant_billing.router)
app.include_router(delivery.router)
app.include_router(inventory.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(business_rules.router)
app.include_router(ai_customer_assistant.router)
app.include_router(ai_staff_assistant.router)
app.include_router(booking_import.router)


@app.get("/health")
def health_check():
    """Phase 24.1: a genuinely useful health/readiness check. Verifies real
    database connectivity rather than returning a static "ok" regardless of
    system state. Never exposes the database URL, credentials, or any other
    sensitive configuration — only a boolean-equivalent status per
    dependency, safe to expose on an unauthenticated endpoint."""
    db_healthy = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_healthy = True
    except Exception:
        db_healthy = False

    overall_status = "healthy" if db_healthy else "unhealthy"
    response = {
        "status": overall_status,
        "checks": {
            "database": "up" if db_healthy else "down",
        },
    }
    return response
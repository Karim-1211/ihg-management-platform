from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import (
    auth, hotels, bookings, service_requests, billing, audit,
    restaurants, reservations, orders, restaurant_billing, delivery, inventory,
    notifications, dashboard, reports, business_rules, ai_customer_assistant, ai_staff_assistant,
    booking_import, media, newsletter, delivery_checkout,
)

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
app.include_router(media.router)
app.include_router(newsletter.router)
app.include_router(delivery_checkout.router)


@app.get("/health")
def health_check():
    db_healthy = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_healthy = True
    except Exception:
        db_healthy = False

    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "checks": {"database": "up" if db_healthy else "down"},
    }
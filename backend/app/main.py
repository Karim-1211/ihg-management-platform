from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth, hotels, bookings, service_requests, billing, audit,
    restaurants, reservations, orders, restaurant_billing, delivery, inventory,
    notifications,
)

app = FastAPI(
    title="IHG Management Platform API",
    version="1.0.0",
    description="Enterprise Hospitality, Restaurant & Food Delivery Management Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "IHG API is running"}
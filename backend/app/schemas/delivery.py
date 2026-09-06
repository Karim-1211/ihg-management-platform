import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.delivery import DeliveryStatus


class DeliveryResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    delivery_staff_id: uuid.UUID | None
    status: DeliveryStatus
    assigned_at: datetime | None
    picked_up_at: datetime | None
    delivered_at: datetime | None
    notes: str | None
    created_at: datetime
    order_number: str | None = None
    delivery_address: str | None = None
    driver_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DeliveryAssignDriver(BaseModel):
    driver_id: uuid.UUID


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
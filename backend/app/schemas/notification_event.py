import uuid

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationEvent(BaseModel):
    event_type: NotificationType
    actor_user_id: uuid.UUID | None = None
    entity_type: str
    entity_id: uuid.UUID  # MUST be the immediate triggering record's id (see event_id derivation rule)
    hotel_id: uuid.UUID | None = None
    restaurant_id: uuid.UUID | None = None
    metadata: dict = {}
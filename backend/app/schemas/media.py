import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.media import MediaEntityType, MediaSourceType


class MediaCreate(BaseModel):
    entity_type: MediaEntityType
    entity_id: uuid.UUID
    source_type: MediaSourceType = MediaSourceType.EXTERNAL_URL
    url: str
    caption: str | None = None
    alt_text: str | None = None
    sort_order: int = 0
    is_primary: bool = False


class MediaUpdate(BaseModel):
    caption: str | None = None
    alt_text: str | None = None
    sort_order: int | None = None


class MediaReorderRequest(BaseModel):
    entity_type: MediaEntityType
    entity_id: uuid.UUID
    ordered_ids: list[uuid.UUID]


class MediaResponse(BaseModel):
    id: uuid.UUID
    entity_type: MediaEntityType
    entity_id: uuid.UUID
    source_type: MediaSourceType
    url: str
    caption: str | None
    alt_text: str | None
    sort_order: int
    is_primary: bool
    is_active: bool
    hotel_id: uuid.UUID | None
    restaurant_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
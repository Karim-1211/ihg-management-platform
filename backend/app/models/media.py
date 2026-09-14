import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class MediaEntityType(str, enum.Enum):
    HOTEL = "HOTEL"
    ROOM_TYPE = "ROOM_TYPE"
    RESTAURANT = "RESTAURANT"
    MENU_ITEM = "MENU_ITEM"


class MediaSourceType(str, enum.Enum):
    EXTERNAL_URL = "EXTERNAL_URL"
    UPLOADED = "UPLOADED"


class MediaAsset(Base):
    """Phase 30a.1 — polymorphic media table for Hotel/RoomType/Restaurant/
    MenuItem imagery. entity_id deliberately has NO foreign key (it can
    point to any of four different tables) — integrity is enforced at the
    service layer, not the database layer, per the locked 30a.1 design."""

    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[MediaEntityType] = mapped_column(SQLEnum(MediaEntityType, name="media_entity_type_enum"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    source_type: Mapped[MediaSourceType] = mapped_column(SQLEnum(MediaSourceType, name="media_source_type_enum"), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(300), nullable=True)
    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hotel_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hotels.id"), nullable=True)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("restaurants.id"), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class AIInteractionLog(Base):
    """Additive audit trail for every AI interaction across all future
    assistant types (customer/staff/manager — 20.2/20.4/20.5 all reuse this
    same table via assistant_type, avoiding a new migration per sub-phase).
    Never stores the full prompt/response verbatim — only a bounded summary,
    which tools were called, and outcome metadata."""

    __tablename__ = "ai_interaction_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    assistant_type: Mapped[str] = mapped_column(String(30), nullable=False, default="CUSTOMER")
    prompt_summary: Mapped[str] = mapped_column(Text, nullable=False)
    tools_called: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_usage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # SUCCESS | FAILED | UNAVAILABLE
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
import enum
import uuid
from decimal import Decimal
from datetime import datetime

from sqlalchemy import (
    String, Text, Numeric, Integer, ForeignKey, DateTime,
    Enum as SQLEnum, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class RuleScopeType(str, enum.Enum):
    GLOBAL = "GLOBAL"
    HOTEL = "HOTEL"
    RESTAURANT = "RESTAURANT"


class RuleValueType(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    MINUTES = "MINUTES"
    INTEGER = "INTEGER"
    HOURS = "HOURS"


class RuleStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class BusinessRule(Base):
    __tablename__ = "business_rules"
    __table_args__ = (
        CheckConstraint(
            "(scope_type = 'GLOBAL' AND hotel_id IS NULL AND restaurant_id IS NULL) OR "
            "(scope_type = 'HOTEL' AND hotel_id IS NOT NULL AND restaurant_id IS NULL) OR "
            "(scope_type = 'RESTAURANT' AND hotel_id IS NULL AND restaurant_id IS NOT NULL)",
            name="ck_business_rule_scope_matches_reference",
        ),
        CheckConstraint("effective_until IS NULL OR effective_until > effective_from", name="ck_business_rule_effective_window_valid"),
        CheckConstraint("priority >= 0", name="ck_business_rule_priority_nonnegative"),
        CheckConstraint(
            "(value_type = 'PERCENTAGE' AND numeric_value >= 0 AND numeric_value <= 1) OR "
            "(value_type = 'MINUTES' AND numeric_value >= 0) OR "
            "(value_type = 'INTEGER' AND numeric_value >= 0 AND numeric_value = trunc(numeric_value)) OR "
            "(value_type = 'HOURS' AND numeric_value >= 0)",
            name="ck_business_rule_value_matches_type",
        ),
        Index(
            "ix_business_rule_resolution",
            "rule_key", "scope_type", "hotel_id", "restaurant_id", "status", "effective_from", "effective_until",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    rule_key: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    scope_type: Mapped[RuleScopeType] = mapped_column(SQLEnum(RuleScopeType, name="rule_scope_type_enum"), nullable=False)
    hotel_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hotels.id"), nullable=True)
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("restaurants.id"), nullable=True)

    value_type: Mapped[RuleValueType] = mapped_column(SQLEnum(RuleValueType, name="rule_value_type_enum"), nullable=False)
    numeric_value: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)

    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[RuleStatus] = mapped_column(SQLEnum(RuleStatus, name="rule_status_enum"), nullable=False, default=RuleStatus.ACTIVE)

    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class BusinessRuleHistory(Base):
    __tablename__ = "business_rule_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business_rules.id"), nullable=False)

    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    change_type: Mapped[str] = mapped_column(String(30), nullable=False)

    previous_numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    new_numeric_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)

    previous_status: Mapped[RuleStatus | None] = mapped_column(SQLEnum(RuleStatus, name="rule_status_enum"), nullable=True)
    new_status: Mapped[RuleStatus | None] = mapped_column(SQLEnum(RuleStatus, name="rule_status_enum"), nullable=True)

    previous_priority: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_priority: Mapped[int | None] = mapped_column(Integer, nullable=True)

    previous_effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    new_effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    previous_effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    new_effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.business_rule import RuleScopeType, RuleValueType, RuleStatus


class BusinessRuleCreate(BaseModel):
    rule_key: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    scope_type: RuleScopeType
    hotel_id: uuid.UUID | None = None
    restaurant_id: uuid.UUID | None = None
    value_type: RuleValueType
    numeric_value: Decimal
    priority: int = Field(ge=0, default=0)
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    reason: str | None = None

    @field_validator("numeric_value")
    @classmethod
    def _nonnegative(cls, v):
        if v < 0:
            raise ValueError("numeric_value must not be negative.")
        return v


class BusinessRuleUpdate(BaseModel):
    version: int  # required for optimistic concurrency — must match the rule's current version
    display_name: str | None = None
    description: str | None = None
    numeric_value: Decimal | None = None
    priority: int | None = Field(default=None, ge=0)
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    status: RuleStatus | None = None
    reason: str | None = None


class BusinessRuleResponse(BaseModel):
    id: uuid.UUID
    rule_key: str
    display_name: str
    description: str | None
    scope_type: RuleScopeType
    hotel_id: uuid.UUID | None
    restaurant_id: uuid.UUID | None
    value_type: RuleValueType
    numeric_value: Decimal
    priority: int
    status: RuleStatus
    effective_from: datetime
    effective_until: datetime | None
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    version: int

    model_config = {"from_attributes": True}


class BusinessRuleHistoryResponse(BaseModel):
    id: uuid.UUID
    business_rule_id: uuid.UUID
    changed_by: uuid.UUID | None
    change_type: str
    previous_numeric_value: Decimal | None
    new_numeric_value: Decimal | None
    previous_status: RuleStatus | None
    new_status: RuleStatus | None
    previous_priority: int | None
    new_priority: int | None
    previous_effective_from: datetime | None
    new_effective_from: datetime | None
    previous_effective_until: datetime | None
    new_effective_until: datetime | None
    reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
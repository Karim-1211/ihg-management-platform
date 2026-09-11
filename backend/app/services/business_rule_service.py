import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.business_rule import BusinessRule, BusinessRuleHistory, RuleScopeType, RuleValueType, RuleStatus
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant
from app.schemas.business_rule_event import RuleLookup
from app.schemas.business_rule import BusinessRuleCreate, BusinessRuleUpdate
from app.services import audit_service


# =========================================================
# RESOLVER — locked in 18.3, unchanged
# =========================================================

class RuleResolution:
    """What the resolver returns — the value plus full reasoning metadata,
    per §19. Never just a bare number."""

    def __init__(self, rule: BusinessRule, resolved_from: str):
        self.value: Decimal = Decimal(str(rule.numeric_value))
        self.rule_id: uuid.UUID = rule.id
        self.rule_key: str = rule.rule_key
        self.display_name: str = rule.display_name
        self.scope_type: RuleScopeType = rule.scope_type
        self.priority: int = rule.priority
        self.effective_from: datetime = rule.effective_from
        self.effective_until: datetime | None = rule.effective_until
        self.resolved_from: str = resolved_from  # "RESTAURANT" | "HOTEL" | "GLOBAL"


def _candidates_at_scope(
    db: Session, rule_key: str, scope_type: RuleScopeType, hotel_id: uuid.UUID | None, restaurant_id: uuid.UUID | None, now: datetime
) -> list[BusinessRule]:
    query = db.query(BusinessRule).filter(
        BusinessRule.rule_key == rule_key,
        BusinessRule.scope_type == scope_type,
        BusinessRule.status == RuleStatus.ACTIVE,
        BusinessRule.effective_from <= now,
    )
    if scope_type == RuleScopeType.HOTEL:
        query = query.filter(BusinessRule.hotel_id == hotel_id)
    elif scope_type == RuleScopeType.RESTAURANT:
        query = query.filter(BusinessRule.restaurant_id == restaurant_id)
    else:
        query = query.filter(BusinessRule.hotel_id.is_(None), BusinessRule.restaurant_id.is_(None))

    rows = query.all()
    return [r for r in rows if r.effective_until is None or r.effective_until > now]


def _pick_highest_priority(rule_key: str, scope_label: str, candidates: list[BusinessRule]) -> BusinessRule | None:
    if not candidates:
        return None
    max_priority = max(r.priority for r in candidates)
    top = [r for r in candidates if r.priority == max_priority]
    if len(top) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Ambiguous business rule configuration for '{rule_key}' at {scope_label} scope: "
                f"{len(top)} active rules share priority {max_priority} with overlapping effective windows. "
                f"This must be resolved by an administrator before the rule can be used."
            ),
        )
    return top[0]


def resolve_rule(db: Session, lookup: RuleLookup) -> RuleResolution:
    """The single authoritative entry point every consumer calls. Precedence:
    RESTAURANT > HOTEL > GLOBAL. Raises 409 on ambiguity, 404 if no rule
    is configured at any applicable scope."""
    now = datetime.now(timezone.utc)

    if lookup.restaurant_id:
        candidates = _candidates_at_scope(db, lookup.rule_key, RuleScopeType.RESTAURANT, None, lookup.restaurant_id, now)
        chosen = _pick_highest_priority(lookup.rule_key, "RESTAURANT", candidates)
        if chosen:
            return RuleResolution(chosen, resolved_from="RESTAURANT")

    if lookup.hotel_id:
        candidates = _candidates_at_scope(db, lookup.rule_key, RuleScopeType.HOTEL, lookup.hotel_id, None, now)
        chosen = _pick_highest_priority(lookup.rule_key, "HOTEL", candidates)
        if chosen:
            return RuleResolution(chosen, resolved_from="HOTEL")

    candidates = _candidates_at_scope(db, lookup.rule_key, RuleScopeType.GLOBAL, None, None, now)
    chosen = _pick_highest_priority(lookup.rule_key, "GLOBAL", candidates)
    if chosen:
        return RuleResolution(chosen, resolved_from="GLOBAL")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No active business rule is configured for '{lookup.rule_key}' at any applicable scope.",
    )


def check_for_conflict(
    db: Session,
    rule_key: str,
    scope_type: RuleScopeType,
    hotel_id: uuid.UUID | None,
    restaurant_id: uuid.UUID | None,
    priority: int,
    effective_from: datetime,
    effective_until: datetime | None,
    exclude_rule_id: uuid.UUID | None = None,
) -> None:
    """Write-time conflict check: same rule_key + same effective scope +
    same priority + ACTIVE + overlapping effective windows = reject."""
    query = db.query(BusinessRule).filter(
        BusinessRule.rule_key == rule_key,
        BusinessRule.scope_type == scope_type,
        BusinessRule.status == RuleStatus.ACTIVE,
        BusinessRule.priority == priority,
    )
    if scope_type == RuleScopeType.HOTEL:
        query = query.filter(BusinessRule.hotel_id == hotel_id)
    elif scope_type == RuleScopeType.RESTAURANT:
        query = query.filter(BusinessRule.restaurant_id == restaurant_id)
    else:
        query = query.filter(BusinessRule.hotel_id.is_(None), BusinessRule.restaurant_id.is_(None))

    if exclude_rule_id:
        query = query.filter(BusinessRule.id != exclude_rule_id)

    for existing in query.all():
        existing_end = existing.effective_until
        new_end = effective_until
        starts_after_existing_ends = existing_end is not None and effective_from >= existing_end
        existing_starts_after_new_ends = new_end is not None and existing.effective_from >= new_end
        if not starts_after_existing_ends and not existing_starts_after_new_ends:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"This configuration conflicts with an existing active rule for '{rule_key}' "
                    f"(same scope, same priority {priority}, overlapping effective dates). "
                    f"Existing rule id: {existing.id}."
                ),
            )


# ---------- Category A resolver helpers (18.5, unchanged) ----------

def get_tax_rate(db: Session) -> Decimal:
    return resolve_rule(db, RuleLookup(rule_key="BILLING_TAX_RATE")).value


def get_service_request_escalation_minutes(db: Session) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="OPERATIONS_SERVICE_REQUEST_ESCALATION_MINUTES")).value)


def get_kitchen_bottleneck_minutes(db: Session) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="OPERATIONS_KITCHEN_BOTTLENECK_MINUTES")).value)


def get_default_reservation_minutes(db: Session) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="RESTAURANT_DEFAULT_RESERVATION_MINUTES")).value)


# ---------- Category B resolver helpers — new in 18.7A ----------
# Each accepts an optional hotel_id so a hotel-specific override is honored
# via the existing HOTEL > GLOBAL precedence, exactly like every other rule.

def get_cancellation_deadline_hours(db: Session, hotel_id: uuid.UUID | None = None) -> Decimal:
    return resolve_rule(db, RuleLookup(rule_key="HOTEL_CANCELLATION_DEADLINE_HOURS", hotel_id=hotel_id)).value


def get_minimum_stay_nights(db: Session, hotel_id: uuid.UUID | None = None) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="HOTEL_MINIMUM_STAY_NIGHTS", hotel_id=hotel_id)).value)


def get_maximum_stay_nights(db: Session, hotel_id: uuid.UUID | None = None) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="HOTEL_MAXIMUM_STAY_NIGHTS", hotel_id=hotel_id)).value)


def get_maximum_advance_booking_days(db: Session, hotel_id: uuid.UUID | None = None) -> int:
    return int(resolve_rule(db, RuleLookup(rule_key="HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS", hotel_id=hotel_id)).value)


def get_restaurant_service_charge_rate(db: Session, restaurant_id: uuid.UUID | None = None) -> Decimal:
    return resolve_rule(db, RuleLookup(rule_key="RESTAURANT_SERVICE_CHARGE_RATE", restaurant_id=restaurant_id)).value


def get_restaurant_service_charge_rate(db: Session, restaurant_id: uuid.UUID | None = None) -> Decimal:
    return resolve_rule(db, RuleLookup(rule_key="RESTAURANT_SERVICE_CHARGE_RATE", restaurant_id=restaurant_id)).value


# =========================================================
# MANAGEMENT — locked in 18.6, unchanged
# =========================================================

def _assert_scope_access(
    db: Session, current_user: User, scope_type: RuleScopeType,
    hotel_id: uuid.UUID | None, restaurant_id: uuid.UUID | None, read_only: bool = False,
) -> None:
    """SUPER_ADMIN: unrestricted. MANAGER: may always READ a GLOBAL rule but
    never WRITE one; may read/write HOTEL/RESTAURANT rules only within their
    own hotel and its restaurants. Ownership is always determined server-side
    from the database, never trusted from the request."""
    if current_user.role == RoleEnum.SUPER_ADMIN:
        return
    if current_user.role != RoleEnum.MANAGER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to manage business rules.")

    if scope_type == RuleScopeType.GLOBAL:
        if read_only:
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only SUPER_ADMIN can manage GLOBAL business rules.")

    if scope_type == RuleScopeType.HOTEL:
        if hotel_id != current_user.hotel_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not manage this hotel.")
        return

    if scope_type == RuleScopeType.RESTAURANT:
        restaurant_ids: list[uuid.UUID] = []
        if current_user.hotel_id:
            restaurant_ids = [r.id for r in db.query(Restaurant.id).filter(Restaurant.hotel_id == current_user.hotel_id).all()]
        if current_user.restaurant_id and current_user.restaurant_id not in restaurant_ids:
            restaurant_ids.append(current_user.restaurant_id)
        if restaurant_id not in restaurant_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not manage this restaurant.")
        return


def _validate_scope_reference(scope_type: RuleScopeType, hotel_id: uuid.UUID | None, restaurant_id: uuid.UUID | None) -> None:
    if scope_type == RuleScopeType.GLOBAL and (hotel_id is not None or restaurant_id is not None):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="GLOBAL rules must not specify hotel_id or restaurant_id.")
    if scope_type == RuleScopeType.HOTEL and (hotel_id is None or restaurant_id is not None):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="HOTEL rules require hotel_id and must not specify restaurant_id.")
    if scope_type == RuleScopeType.RESTAURANT and (restaurant_id is None or hotel_id is not None):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="RESTAURANT rules require restaurant_id and must not specify hotel_id.")


def _assert_value_type_range(value_type: RuleValueType, numeric_value: Decimal) -> None:
    if value_type == RuleValueType.PERCENTAGE:
        if numeric_value < 0 or numeric_value > 1:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="PERCENTAGE values must be between 0 and 1 (e.g. 0.05 for 5%).")
    elif value_type == RuleValueType.MINUTES:
        if numeric_value < 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="MINUTES values must not be negative.")
    elif value_type == RuleValueType.HOURS:
        if numeric_value < 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="HOURS values must not be negative.")
    elif value_type == RuleValueType.INTEGER:
        if numeric_value < 0 or numeric_value != numeric_value.to_integral_value():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="INTEGER values must be a non-negative whole number.")


def create_rule(db: Session, current_user: User, data: BusinessRuleCreate) -> BusinessRule:
    _assert_scope_access(db, current_user, data.scope_type, data.hotel_id, data.restaurant_id, read_only=False)
    _validate_scope_reference(data.scope_type, data.hotel_id, data.restaurant_id)
    _assert_value_type_range(data.value_type, data.numeric_value)

    effective_from = data.effective_from or datetime.now(timezone.utc)
    if data.effective_until is not None and data.effective_until <= effective_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="effective_until must be after effective_from.")

    priority = data.priority or 0

    check_for_conflict(db, data.rule_key, data.scope_type, data.hotel_id, data.restaurant_id, priority, effective_from, data.effective_until)

    rule = BusinessRule(
        rule_key=data.rule_key,
        display_name=data.display_name,
        description=data.description,
        scope_type=data.scope_type,
        hotel_id=data.hotel_id,
        restaurant_id=data.restaurant_id,
        value_type=data.value_type,
        numeric_value=data.numeric_value,
        priority=priority,
        status=RuleStatus.ACTIVE,
        effective_from=effective_from,
        effective_until=data.effective_until,
        created_by=current_user.id,
        updated_by=current_user.id,
        version=1,
    )
    db.add(rule)
    db.flush()

    history = BusinessRuleHistory(
        business_rule_id=rule.id,
        changed_by=current_user.id,
        change_type="CREATED",
        new_numeric_value=rule.numeric_value,
        new_status=rule.status,
        new_priority=rule.priority,
        new_effective_from=rule.effective_from,
        new_effective_until=rule.effective_until,
        reason=data.reason,
    )
    db.add(history)

    db.commit()
    db.refresh(rule)

    audit_service.log_action(
        db, current_user.id, "CREATE_BUSINESS_RULE", "business_rule", rule.id,
        f"Created rule {rule.rule_key} ({rule.scope_type.value}) = {rule.numeric_value}",
    )
    return rule


def update_rule(db: Session, current_user: User, rule_id: uuid.UUID, data: BusinessRuleUpdate) -> BusinessRule:
    rule = db.query(BusinessRule).filter(BusinessRule.id == rule_id).with_for_update().first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business rule not found.")

    _assert_scope_access(db, current_user, rule.scope_type, rule.hotel_id, rule.restaurant_id, read_only=False)

    if data.version != rule.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This rule was changed by someone else (current version {rule.version}, you have {data.version}). Reload and try again.",
        )

    prev_numeric_value = rule.numeric_value
    prev_status = rule.status
    prev_priority = rule.priority
    prev_effective_from = rule.effective_from
    prev_effective_until = rule.effective_until

    changed_fields: list[str] = []

    if data.display_name is not None:
        rule.display_name = data.display_name
    if data.description is not None:
        rule.description = data.description

    if data.numeric_value is not None and data.numeric_value != rule.numeric_value:
        _assert_value_type_range(rule.value_type, data.numeric_value)
        rule.numeric_value = data.numeric_value
        changed_fields.append("VALUE")

    if data.priority is not None and data.priority != rule.priority:
        rule.priority = data.priority
        changed_fields.append("PRIORITY")

    new_effective_from = data.effective_from if data.effective_from is not None else rule.effective_from
    if "effective_until" in data.model_fields_set:
        new_effective_until = data.effective_until
    else:
        new_effective_until = rule.effective_until

    if new_effective_until is not None and new_effective_until <= new_effective_from:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="effective_until must be after effective_from.")

    if new_effective_from != rule.effective_from or new_effective_until != rule.effective_until:
        rule.effective_from = new_effective_from
        rule.effective_until = new_effective_until
        changed_fields.append("SCHEDULE")

    if data.status is not None and data.status != rule.status:
        rule.status = data.status
        changed_fields.append("STATUS")

    if rule.status == RuleStatus.ACTIVE and changed_fields:
        check_for_conflict(
            db, rule.rule_key, rule.scope_type, rule.hotel_id, rule.restaurant_id,
            rule.priority, rule.effective_from, rule.effective_until, exclude_rule_id=rule.id,
        )

    if not changed_fields:
        return rule

    rule.version += 1
    rule.updated_by = current_user.id

    change_type_label = "+".join(changed_fields)[:30]
    history = BusinessRuleHistory(
        business_rule_id=rule.id,
        changed_by=current_user.id,
        change_type=change_type_label,
        previous_numeric_value=prev_numeric_value,
        new_numeric_value=rule.numeric_value,
        previous_status=prev_status,
        new_status=rule.status,
        previous_priority=prev_priority,
        new_priority=rule.priority,
        previous_effective_from=prev_effective_from,
        new_effective_from=rule.effective_from,
        previous_effective_until=prev_effective_until,
        new_effective_until=rule.effective_until,
        reason=data.reason,
    )
    db.add(history)

    db.commit()
    db.refresh(rule)

    audit_service.log_action(
        db, current_user.id, "UPDATE_BUSINESS_RULE", "business_rule", rule.id,
        f"Updated rule {rule.rule_key}: {change_type_label} — now {rule.numeric_value}, status {rule.status.value}",
    )
    return rule


def get_rule_or_404(db: Session, current_user: User, rule_id: uuid.UUID) -> BusinessRule:
    rule = db.query(BusinessRule).filter(BusinessRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business rule not found.")
    _assert_scope_access(db, current_user, rule.scope_type, rule.hotel_id, rule.restaurant_id, read_only=True)
    return rule


def list_rules(
    db: Session, current_user: User,
    rule_key: str | None = None, scope_type: RuleScopeType | None = None, status_filter: RuleStatus | None = None,
) -> list[BusinessRule]:
    query = db.query(BusinessRule)

    if current_user.role == RoleEnum.MANAGER:
        hotel_ids = [current_user.hotel_id] if current_user.hotel_id else []
        restaurant_ids = [r.id for r in db.query(Restaurant.id).filter(Restaurant.hotel_id.in_(hotel_ids)).all()] if hotel_ids else []
        if current_user.restaurant_id and current_user.restaurant_id not in restaurant_ids:
            restaurant_ids.append(current_user.restaurant_id)
        from sqlalchemy import or_
        conditions = [BusinessRule.scope_type == RuleScopeType.GLOBAL]
        if hotel_ids:
            conditions.append(BusinessRule.hotel_id.in_(hotel_ids))
        if restaurant_ids:
            conditions.append(BusinessRule.restaurant_id.in_(restaurant_ids))
        query = query.filter(or_(*conditions))
    elif current_user.role != RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to view business rules.")

    if rule_key:
        query = query.filter(BusinessRule.rule_key == rule_key)
    if scope_type:
        query = query.filter(BusinessRule.scope_type == scope_type)
    if status_filter:
        query = query.filter(BusinessRule.status == status_filter)

    return query.order_by(BusinessRule.rule_key, BusinessRule.scope_type).all()


def get_history(db: Session, current_user: User, rule_id: uuid.UUID) -> list[BusinessRuleHistory]:
    rule = get_rule_or_404(db, current_user, rule_id)
    return (
        db.query(BusinessRuleHistory)
        .filter(BusinessRuleHistory.business_rule_id == rule.id)
        .order_by(BusinessRuleHistory.created_at.desc())
        .all()
    )
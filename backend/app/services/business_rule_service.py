import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.business_rule import BusinessRule, RuleScopeType, RuleStatus
from app.schemas.business_rule_event import RuleLookup


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
    # effective_until is nullable (open-ended); filter in Python since a
    # NULL comparison in SQL would incorrectly exclude open-ended rules.
    return [r for r in rows if r.effective_until is None or r.effective_until > now]


def _pick_highest_priority(rule_key: str, scope_label: str, candidates: list[BusinessRule]) -> BusinessRule | None:
    if not candidates:
        return None
    max_priority = max(r.priority for r in candidates)
    top = [r for r in candidates if r.priority == max_priority]
    if len(top) > 1:
        # Locked design: ambiguity is a data-entry error, never silently resolved.
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
    """The single authoritative entry point every consumer (billing,
    dashboard, reports, future Category B enforcement) calls. Precedence:
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
    """Write-time conflict check, per the locked design: same rule_key +
    same effective scope + same priority + ACTIVE + overlapping effective
    windows = reject. Scope inheritance (a HOTEL rule alongside a GLOBAL
    rule for the same key) is NOT a conflict — only same-scope collisions are."""
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
        # Two windows overlap unless one entirely ends before the other begins.
        # NULL end = open-ended (treated as +infinity for this comparison).
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
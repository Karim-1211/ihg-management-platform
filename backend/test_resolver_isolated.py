"""Isolated verification of the Phase 18.3 rule resolver — run directly with
python, not pytest, matching this project's existing ad-hoc verification
style. Creates rules, tests precedence/ambiguity/conflict directly against
the resolver, then cleans up. Read-only assertions with clear pass/fail
printouts."""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# These imports register the referenced tables (users, hotels, restaurants)
# into SQLAlchemy's metadata so business_rule.py's FK columns can resolve,
# even though we don't call anything from these modules directly here.
from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleScopeType, RuleValueType, RuleStatus
from app.schemas.business_rule_event import RuleLookup
from app.services import business_rule_service
from fastapi import HTTPException

TEST_KEY = "TEST_RESOLVER_PROBE_RATE"


def make_rule(db, scope_type, hotel_id=None, restaurant_id=None, value="0.05", priority=0, status=RuleStatus.ACTIVE, effective_from=None, effective_until=None):
    rule = BusinessRule(
        rule_key=TEST_KEY,
        display_name="Test Resolver Probe",
        scope_type=scope_type,
        hotel_id=hotel_id,
        restaurant_id=restaurant_id,
        value_type=RuleValueType.PERCENTAGE,
        numeric_value=Decimal(value),
        priority=priority,
        status=status,
        effective_from=effective_from or (datetime.now(timezone.utc) - timedelta(days=1)),
        effective_until=effective_until,
    )
    db.add(rule)
    db.flush()
    return rule


def cleanup(db):
    db.query(BusinessRule).filter(BusinessRule.rule_key == TEST_KEY).delete()
    db.commit()


def run():
    db = SessionLocal()
    passed = 0
    failed = 0

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    try:
        cleanup(db)

        print("1. GLOBAL-only rule resolves correctly...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05")
        db.commit()
        result = business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
        check("resolved value is 0.05", result.value == Decimal("0.05"))
        check("resolved_from is GLOBAL", result.resolved_from == "GLOBAL")
        cleanup(db)

        print("2. HOTEL override beats GLOBAL default...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05")
        from app.models.hotel import Hotel
        real_hotel = db.query(Hotel).first()
        if real_hotel:
            make_rule(db, RuleScopeType.HOTEL, hotel_id=real_hotel.id, value="0.07")
            db.commit()
            result = business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY, hotel_id=real_hotel.id))
            check("HOTEL rule (0.07) beats GLOBAL (0.05)", result.value == Decimal("0.07"))
            check("resolved_from is HOTEL", result.resolved_from == "HOTEL")
        else:
            print("   SKIPPED - no hotel row exists to test against")
        cleanup(db)

        print("3. Higher priority wins within the same scope...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", priority=0)
        make_rule(db, RuleScopeType.GLOBAL, value="0.09", priority=10)
        db.commit()
        result = business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
        check("priority 10 rule (0.09) wins over priority 0 (0.05)", result.value == Decimal("0.09"))
        cleanup(db)

        print("4. Expired rule is correctly excluded...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", effective_from=datetime.now(timezone.utc) - timedelta(days=10), effective_until=datetime.now(timezone.utc) - timedelta(days=1))
        db.commit()
        try:
            business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
            check("expired rule correctly excluded (should have raised 404)", False)
        except HTTPException as e:
            check("expired rule correctly excluded (404 raised)", e.status_code == 404)
        cleanup(db)

        print("5. Future rule (not yet effective) is correctly excluded...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", effective_from=datetime.now(timezone.utc) + timedelta(days=10))
        db.commit()
        try:
            business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
            check("future rule correctly excluded (should have raised 404)", False)
        except HTTPException as e:
            check("future rule correctly excluded (404 raised)", e.status_code == 404)
        cleanup(db)

        print("6. INACTIVE rule is correctly excluded...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", status=RuleStatus.INACTIVE)
        db.commit()
        try:
            business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
            check("inactive rule correctly excluded (should have raised 404)", False)
        except HTTPException as e:
            check("inactive rule correctly excluded (404 raised)", e.status_code == 404)
        cleanup(db)

        print("7. Ambiguous same-priority overlapping rules raise 409, never silently resolved...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", priority=5)
        make_rule(db, RuleScopeType.GLOBAL, value="0.07", priority=5)
        db.commit()
        try:
            business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
            check("ambiguous config correctly raised (should have raised 409)", False)
        except HTTPException as e:
            check("ambiguous config correctly raised (409 raised)", e.status_code == 409)
        cleanup(db)

        print("8. No rule configured anywhere raises 404 with a clear message...")
        try:
            business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY))
            check("missing rule correctly raised (should have raised 404)", False)
        except HTTPException as e:
            check("missing rule correctly raised (404 raised)", e.status_code == 404)

        print("9. Write-time conflict detection blocks an overlapping same-scope/priority rule...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", priority=0, effective_from=datetime.now(timezone.utc) - timedelta(days=5), effective_until=datetime.now(timezone.utc) + timedelta(days=30))
        db.commit()
        try:
            business_rule_service.check_for_conflict(
                db, TEST_KEY, RuleScopeType.GLOBAL, None, None, priority=0,
                effective_from=datetime.now(timezone.utc), effective_until=None,
            )
            check("conflicting write correctly blocked (should have raised 409)", False)
        except HTTPException as e:
            check("conflicting write correctly blocked (409 raised)", e.status_code == 409)
        cleanup(db)

        print("10. Non-conflicting rule (different priority) passes conflict check cleanly...")
        make_rule(db, RuleScopeType.GLOBAL, value="0.05", priority=0)
        db.commit()
        try:
            business_rule_service.check_for_conflict(
                db, TEST_KEY, RuleScopeType.GLOBAL, None, None, priority=10,
                effective_from=datetime.now(timezone.utc), effective_until=None,
            )
            check("non-conflicting rule (different priority) passes cleanly", True)
        except HTTPException:
            check("non-conflicting rule (different priority) passes cleanly", False)
        cleanup(db)

    finally:
        cleanup(db)
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL RESOLVER TESTS PASSED")


if __name__ == "__main__":
    run()
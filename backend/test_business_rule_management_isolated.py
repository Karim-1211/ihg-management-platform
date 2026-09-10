"""Isolated verification of Phase 18.6 business rule management (create,
update with optimistic concurrency, history, authorization, conflict
detection). Run directly with python. Self-adapting: reads real users/hotels
from the database rather than assuming fixed IDs, so it works regardless of
exact current data state. Cleans up all test rows on exit."""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, BusinessRuleHistory, RuleScopeType, RuleValueType, RuleStatus
from app.models.user import User, RoleEnum
from app.models.hotel import Hotel
from app.schemas.business_rule import BusinessRuleCreate, BusinessRuleUpdate
from app.schemas.business_rule_event import RuleLookup
from app.services import business_rule_service
from fastapi import HTTPException

TEST_KEY = "TEST_MGMT_RULE"


def cleanup(db):
    rule_ids = [r.id for r in db.query(BusinessRule.id).filter(BusinessRule.rule_key == TEST_KEY).all()]
    if rule_ids:
        db.query(BusinessRuleHistory).filter(BusinessRuleHistory.business_rule_id.in_(rule_ids)).delete(synchronize_session=False)
        db.query(BusinessRule).filter(BusinessRule.id.in_(rule_ids)).delete(synchronize_session=False)
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

        print("0. Loading real SUPER_ADMIN and MANAGER users...")
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        manager = db.query(User).filter(User.role == RoleEnum.MANAGER).first()
        if not admin:
            print("   ABORT - no SUPER_ADMIN user found in database.")
            return
        print(f"   admin: {admin.email}")
        if manager:
            print(f"   manager: {manager.email}, hotel_id={manager.hotel_id}, restaurant_id={manager.restaurant_id}")
        else:
            print("   NOTE - no MANAGER user found; manager-specific checks will be skipped.")

        print("\n1. SUPER_ADMIN creates a GLOBAL rule...")
        rule1 = business_rule_service.create_rule(db, admin, BusinessRuleCreate(
            rule_key=TEST_KEY, display_name="Test Management Rule", scope_type=RuleScopeType.GLOBAL,
            value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.10"), priority=0,
            reason="isolated test",
        ))
        check("rule created with version=1", rule1.version == 1)
        check("rule is ACTIVE", rule1.status == RuleStatus.ACTIVE)

        print("\n2. History shows exactly one CREATED entry...")
        history = business_rule_service.get_history(db, admin, rule1.id)
        check("exactly 1 history entry", len(history) == 1)
        check("change_type is CREATED", history[0].change_type == "CREATED")

        if manager:
            print("\n3. MANAGER cannot create a GLOBAL rule (403)...")
            try:
                business_rule_service.create_rule(db, manager, BusinessRuleCreate(
                    rule_key=TEST_KEY, display_name="Should Fail", scope_type=RuleScopeType.GLOBAL,
                    value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.20"),
                ))
                check("manager blocked from GLOBAL create (should have raised 403)", False)
            except HTTPException as e:
                check("manager blocked from GLOBAL create (403 raised)", e.status_code == 403)

            if manager.hotel_id:
                print("\n4. MANAGER creates a HOTEL rule for their own hotel...")
                rule2 = business_rule_service.create_rule(db, manager, BusinessRuleCreate(
                    rule_key=TEST_KEY, display_name="Test Hotel Rule", scope_type=RuleScopeType.HOTEL,
                    hotel_id=manager.hotel_id, value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.15"),
                    priority=0, reason="isolated test",
                ))
                check("hotel rule created", rule2.version == 1)

                print("\n5. Resolver returns HOTEL rule (0.15), not GLOBAL (0.10), for that hotel...")
                result = business_rule_service.resolve_rule(db, RuleLookup(rule_key=TEST_KEY, hotel_id=manager.hotel_id))
                check("HOTEL override wins", result.value == Decimal("0.15"))
                check("resolved_from is HOTEL", result.resolved_from == "HOTEL")

                other_hotel = db.query(Hotel).filter(Hotel.id != manager.hotel_id).first()
                if other_hotel:
                    print("\n6. MANAGER cannot create a HOTEL rule for a different hotel (403)...")
                    try:
                        business_rule_service.create_rule(db, manager, BusinessRuleCreate(
                            rule_key=TEST_KEY, display_name="Should Fail", scope_type=RuleScopeType.HOTEL,
                            hotel_id=other_hotel.id, value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.99"),
                        ))
                        check("cross-hotel create blocked (should have raised 403)", False)
                    except HTTPException as e:
                        check("cross-hotel create blocked (403 raised)", e.status_code == 403)
                else:
                    print("   SKIPPED - only one hotel exists in the database; cannot test cross-hotel isolation.")

                print("\n7. Update with WRONG version is rejected (409)...")
                try:
                    business_rule_service.update_rule(db, manager, rule2.id, BusinessRuleUpdate(version=999, numeric_value=Decimal("0.16")))
                    check("wrong-version update blocked (should have raised 409)", False)
                except HTTPException as e:
                    check("wrong-version update blocked (409 raised)", e.status_code == 409)

                print("\n8. Update with CORRECT version succeeds, version increments, history recorded...")
                updated = business_rule_service.update_rule(db, manager, rule2.id, BusinessRuleUpdate(
                    version=rule2.version, numeric_value=Decimal("0.18"), reason="test value change",
                ))
                check("value updated to 0.18", updated.numeric_value == Decimal("0.18"))
                check("version incremented to 2", updated.version == 2)

                history2 = business_rule_service.get_history(db, manager, rule2.id)
                check("history now has 2 entries", len(history2) == 2)
                check("most recent entry reflects the VALUE change", "VALUE" in history2[0].change_type)
                check("history captured correct previous value", history2[0].previous_numeric_value == Decimal("0.15"))
                check("history captured correct new value", history2[0].new_numeric_value == Decimal("0.18"))
            else:
                print("\n4-8. SKIPPED - manager has no hotel_id assigned.")

        print("\n9. Creating a second ACTIVE GLOBAL rule with same key/priority/overlapping window is rejected (409)...")
        try:
            business_rule_service.create_rule(db, admin, BusinessRuleCreate(
                rule_key=TEST_KEY, display_name="Duplicate", scope_type=RuleScopeType.GLOBAL,
                value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.20"), priority=0,
            ))
            check("conflicting GLOBAL rule blocked (should have raised 409)", False)
        except HTTPException as e:
            check("conflicting GLOBAL rule blocked (409 raised)", e.status_code == 409)

        print("\n10. Deactivating the GLOBAL rule then creating a new one at the same priority succeeds (inactive rules don't conflict)...")
        deactivated = business_rule_service.update_rule(db, admin, rule1.id, BusinessRuleUpdate(version=rule1.version, status=RuleStatus.INACTIVE, reason="test deactivate"))
        check("rule is now INACTIVE", deactivated.status == RuleStatus.INACTIVE)
        try:
            rule3 = business_rule_service.create_rule(db, admin, BusinessRuleCreate(
                rule_key=TEST_KEY, display_name="Replacement", scope_type=RuleScopeType.GLOBAL,
                value_type=RuleValueType.PERCENTAGE, numeric_value=Decimal("0.25"), priority=0,
            ))
            check("new GLOBAL rule created after deactivation (no false conflict)", rule3.version == 1)
        except HTTPException:
            check("new GLOBAL rule created after deactivation (no false conflict)", False)

    finally:
        cleanup(db)
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL BUSINESS RULE MANAGEMENT TESTS PASSED")


if __name__ == "__main__":
    run()
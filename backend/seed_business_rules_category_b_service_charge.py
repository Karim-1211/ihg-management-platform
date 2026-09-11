"""Seeds RESTAURANT_SERVICE_CHARGE_RATE at 0 (inactive-equivalent — a 0%
charge changes nothing). This is the deliberate 'off by default' starting
point per the locked 18.7B plan: prove the calculation logic first, then a
manager can raise it to a nonzero value through the UI. Idempotent."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from decimal import Decimal

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleScopeType, RuleValueType, RuleStatus


def run():
    db = SessionLocal()
    try:
        existing = db.query(BusinessRule).filter(
            BusinessRule.rule_key == "RESTAURANT_SERVICE_CHARGE_RATE",
            BusinessRule.scope_type == RuleScopeType.GLOBAL,
            BusinessRule.status == RuleStatus.ACTIVE,
        ).first()
        if existing:
            print(f"SKIPPED (already exists): RESTAURANT_SERVICE_CHARGE_RATE = {existing.numeric_value}")
            return

        rule = BusinessRule(
            rule_key="RESTAURANT_SERVICE_CHARGE_RATE",
            display_name="Restaurant Service Charge",
            description="Optional service charge applied to restaurant orders, as a percentage of subtotal. 0 means no charge.",
            scope_type=RuleScopeType.GLOBAL,
            value_type=RuleValueType.PERCENTAGE,
            numeric_value=Decimal("0"),
            priority=0,
            status=RuleStatus.ACTIVE,
        )
        db.add(rule)
        db.commit()
        print("CREATED: RESTAURANT_SERVICE_CHARGE_RATE = 0")
    except Exception as e:
        db.rollback()
        print(f"SEED FAILED, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
"""Creates the PROMO_SUBSCRIBER_PERCENT_OFF business rule, so the subscriber
discount is managed from the Business Rules page like every other policy
rather than being fixed in code.

Run from backend/:
    python seed_promo_rule.py
    python seed_promo_rule.py 0.15     # a 15% offer instead
"""
import sys
from datetime import datetime, timezone
from decimal import Decimal

from app.core.database import SessionLocal
# Every model BusinessRule points at must be imported, or SQLAlchemy cannot
# resolve its foreign keys when the session flushes.
from app.models.business_rule import BusinessRule, RuleScopeType, RuleStatus, RuleValueType
from app.models.hotel import Hotel  # noqa: F401
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import RoleEnum, User

RULE_KEY = "PROMO_SUBSCRIBER_PERCENT_OFF"


def run(percent: Decimal):
    if percent <= 0 or percent > 1:
        print(f"\n  {percent} is not a valid percentage — use a fraction, e.g. 0.10 for 10%.\n")
        return

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()

        existing = (
            db.query(BusinessRule)
            .filter(BusinessRule.rule_key == RULE_KEY, BusinessRule.scope_type == RuleScopeType.GLOBAL)
            .first()
        )
        if existing:
            existing.numeric_value = percent
            existing.status = RuleStatus.ACTIVE
            existing.version += 1
            db.commit()
            print(f"\n  Updated {RULE_KEY} to {percent * 100:.0f}%\n")
            return

        db.add(BusinessRule(
            rule_key=RULE_KEY,
            display_name="Subscriber discount",
            description="Percentage taken off the subtotal when a newsletter subscriber redeems their welcome code.",
            scope_type=RuleScopeType.GLOBAL,
            value_type=RuleValueType.PERCENTAGE,
            numeric_value=percent,
            priority=0,
            status=RuleStatus.ACTIVE,
            effective_from=datetime.now(timezone.utc),
            created_by=admin.id if admin else None,
            updated_by=admin.id if admin else None,
            version=1,
        ))
        db.commit()
        print(f"\n  Created {RULE_KEY} at {percent * 100:.0f}%")
        print("  Managers can now change this from Staff → Business Rules.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    value = Decimal(sys.argv[1]) if len(sys.argv) > 1 else Decimal("0.10")
    run(value)
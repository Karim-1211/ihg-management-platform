"""Creates the delivery-time business rules, so the estimate a guest sees is
a figure a manager sets — not a number invented in the frontend.

Two rules rather than one: a kitchen needs preparation time and a rider needs
travel time, and a manager may want to change either independently.

Run from backend/:
    python seed_delivery_rules.py
    python seed_delivery_rules.py 25 20     # prep 25 min, travel 20 min
"""
import sys
from datetime import datetime, timezone
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleScopeType, RuleStatus, RuleValueType
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import RoleEnum, User

RULES = [
    {
        "key": "DELIVERY_PREPARATION_MINUTES",
        "name": "Kitchen preparation time",
        "description": "Typical minutes between an order being confirmed and being ready for a rider.",
        "default": 25,
    },
    {
        "key": "DELIVERY_TRAVEL_MINUTES",
        "name": "Rider travel time",
        "description": "Typical minutes between a rider collecting an order and reaching the guest.",
        "default": 20,
    },
]


def run(values):
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()

        for rule, value in zip(RULES, values):
            existing = (
                db.query(BusinessRule)
                .filter(BusinessRule.rule_key == rule["key"], BusinessRule.scope_type == RuleScopeType.GLOBAL)
                .first()
            )
            if existing:
                existing.numeric_value = Decimal(value)
                existing.status = RuleStatus.ACTIVE
                existing.version += 1
                print(f"  ~ {rule['name']}: {value} minutes")
                continue

            db.add(BusinessRule(
                rule_key=rule["key"],
                display_name=rule["name"],
                description=rule["description"],
                scope_type=RuleScopeType.GLOBAL,
                value_type=RuleValueType.MINUTES,
                numeric_value=Decimal(value),
                priority=0,
                status=RuleStatus.ACTIVE,
                effective_from=datetime.now(timezone.utc),
                created_by=admin.id if admin else None,
                updated_by=admin.id if admin else None,
                version=1,
            ))
            print(f"  + {rule['name']}: {value} minutes")

        db.commit()
        total = sum(int(v) for v in values)
        print(f"\n  Guests will see roughly {total}–{total + 10} minutes.")
        print("  Managers can change both from Staff → Business Rules.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    run(args if len(args) == 2 else [r["default"] for r in RULES])
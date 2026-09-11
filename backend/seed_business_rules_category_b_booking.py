"""One-time seed: creates the four Category B booking-restriction rules as
GLOBAL rules with permissive defaults. Unlike Category A, these are NEW
restrictions with no prior hard-coded behavior to preserve — the defaults
chosen here are a deliberate, generous starting policy (see business_rule_constants.py
for the exact reasoning), not a neutral migration. Idempotent: safe to
re-run, skips any rule_key that already has an active GLOBAL row."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from decimal import Decimal

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleScopeType, RuleValueType, RuleStatus

CATEGORY_B_BOOKING_SEED = [
    {
        "rule_key": "HOTEL_CANCELLATION_DEADLINE_HOURS",
        "display_name": "Cancellation Deadline",
        "description": "Guests may cancel a booking up to this many hours before check-in. 0 means no deadline (cancellation always allowed before check-in).",
        "value_type": RuleValueType.HOURS,
        "numeric_value": Decimal("0"),
    },
    {
        "rule_key": "HOTEL_MINIMUM_STAY_NIGHTS",
        "display_name": "Minimum Stay",
        "description": "The minimum number of nights a booking must cover.",
        "value_type": RuleValueType.INTEGER,
        "numeric_value": Decimal("1"),
    },
    {
        "rule_key": "HOTEL_MAXIMUM_STAY_NIGHTS",
        "display_name": "Maximum Stay",
        "description": "The maximum number of nights a single booking may cover.",
        "value_type": RuleValueType.INTEGER,
        "numeric_value": Decimal("365"),
    },
    {
        "rule_key": "HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS",
        "display_name": "Maximum Advance Booking",
        "description": "The furthest in advance a check-in date may be booked, in days from today.",
        "value_type": RuleValueType.INTEGER,
        "numeric_value": Decimal("730"),
    },
]


def run():
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for spec in CATEGORY_B_BOOKING_SEED:
            existing = db.query(BusinessRule).filter(
                BusinessRule.rule_key == spec["rule_key"],
                BusinessRule.scope_type == RuleScopeType.GLOBAL,
                BusinessRule.status == RuleStatus.ACTIVE,
            ).first()
            if existing:
                print(f"SKIPPED (already exists): {spec['rule_key']} = {existing.numeric_value}")
                skipped += 1
                continue

            rule = BusinessRule(
                rule_key=spec["rule_key"],
                display_name=spec["display_name"],
                description=spec["description"],
                scope_type=RuleScopeType.GLOBAL,
                value_type=spec["value_type"],
                numeric_value=spec["numeric_value"],
                priority=0,
                status=RuleStatus.ACTIVE,
            )
            db.add(rule)
            db.commit()
            print(f"CREATED: {spec['rule_key']} = {spec['numeric_value']}")
            created += 1

        print()
        print(f"Done. Created: {created}, Skipped (already present): {skipped}")

    except Exception as e:
        db.rollback()
        print(f"SEED FAILED, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
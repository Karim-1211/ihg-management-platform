"""One-time seed: creates the four Category A business rules as GLOBAL rules
matching the CURRENT hard-coded behavior exactly. This does NOT change any
consuming service's behavior — those still read the old constants until
each is explicitly cut over in a later, separate step. Idempotent: safe to
re-run, skips any rule_key that already has an active GLOBAL row."""

# These imports register the referenced tables (users, hotels, restaurants)
# into SQLAlchemy's metadata so business_rule.py's FK columns can resolve.
from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from decimal import Decimal

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleScopeType, RuleValueType, RuleStatus
from app.core.config import settings
from app.services import dashboard_constants

CATEGORY_A_SEED = [
    {
        "rule_key": "BILLING_TAX_RATE",
        "display_name": "Tax Rate",
        "description": "Tax rate applied to hotel and restaurant invoices.",
        "value_type": RuleValueType.PERCENTAGE,
        "numeric_value": Decimal(str(settings.tax_rate)),
    },
    {
        "rule_key": "OPERATIONS_SERVICE_REQUEST_ESCALATION_MINUTES",
        "display_name": "Service Request Escalation",
        "description": "Minutes after which a pending service request is flagged as overdue.",
        "value_type": RuleValueType.MINUTES,
        "numeric_value": Decimal(str(dashboard_constants.SERVICE_REQUEST_ESCALATION_MINUTES)),
    },
    {
        "rule_key": "OPERATIONS_KITCHEN_BOTTLENECK_MINUTES",
        "display_name": "Kitchen Bottleneck Threshold",
        "description": "Minutes an order may remain PREPARING before it is flagged as a bottleneck.",
        "value_type": RuleValueType.MINUTES,
        "numeric_value": Decimal(str(dashboard_constants.KITCHEN_PREPARATION_ESCALATION_MINUTES)),
    },
    {
        "rule_key": "RESTAURANT_DEFAULT_RESERVATION_MINUTES",
        "display_name": "Default Reservation Duration",
        "description": "Default length of a table reservation when no explicit end time is given.",
        "value_type": RuleValueType.MINUTES,
        "numeric_value": Decimal(str(settings.default_reservation_minutes)),
    },
]


def run():
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        for spec in CATEGORY_A_SEED:
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
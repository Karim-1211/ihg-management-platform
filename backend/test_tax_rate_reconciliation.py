"""Phase 18.4 — BILLING_TAX_RATE verification. Proves the resolver returns
EXACTLY the same value as the current hard-coded settings.tax_rate, and that
a tax calculation done both ways produces an identical result to the cent.
This must pass before any consuming service is cut over to the resolver."""

from decimal import Decimal, ROUND_HALF_UP

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.core.config import settings
from app.schemas.business_rule_event import RuleLookup
from app.services import business_rule_service


def run():
    db = SessionLocal()
    try:
        print("1. Fetching BILLING_TAX_RATE via the resolver...")
        result = business_rule_service.resolve_rule(db, RuleLookup(rule_key="BILLING_TAX_RATE"))
        resolver_rate = result.value
        old_rate = Decimal(str(settings.tax_rate))

        print(f"   Old hard-coded rate: {old_rate}")
        print(f"   Resolver rate:       {resolver_rate}")
        print(f"   resolved_from:       {result.resolved_from}")

        assert resolver_rate == old_rate, f"MISMATCH: old={old_rate} != resolver={resolver_rate}"
        print("   OK - resolver rate exactly matches the current hard-coded rate")

        print()
        print("2. Verifying a representative tax calculation matches to the cent...")
        test_subtotals = [Decimal("100.00"), Decimal("19.43"), Decimal("320.25"), Decimal("0.01"), Decimal("9999.99")]

        def round_currency(v: Decimal) -> Decimal:
            return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        all_match = True
        for subtotal in test_subtotals:
            old_tax = round_currency(subtotal * old_rate)
            new_tax = round_currency(subtotal * resolver_rate)
            match = old_tax == new_tax
            all_match = all_match and match
            status_label = "OK" if match else "MISMATCH"
            print(f"   {status_label} - subtotal={subtotal}: old_tax={old_tax}, resolver_tax={new_tax}")

        assert all_match, "One or more tax calculations diverged between old and resolver-driven rates."
        print()
        print("ALL TAX RATE RECONCILIATION CHECKS PASSED")

    finally:
        db.close()


if __name__ == "__main__":
    run()
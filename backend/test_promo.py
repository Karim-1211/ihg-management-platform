"""End-to-end check of the promotional code flow, with no HTTP client or
JSON escaping involved.

Run from backend/:
    python test_promo.py
"""
from decimal import Decimal

from fastapi import HTTPException

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.promo import PromoCode, PromoScope
from app.models.restaurant import Restaurant  # noqa: F401
from app.models.user import User  # noqa: F401
from app.services import newsletter_service, promo_service

TEST_EMAIL = "promo.test@example.com"


def check(label, fn):
    try:
        result = fn()
        print(f"  PASS  {label}")
        return result
    except HTTPException as exc:
        print(f"  FAIL  {label}\n        {exc.detail}")
        return None
    except Exception as exc:
        print(f"  FAIL  {label}\n        {type(exc).__name__}: {exc}")
        return None


def expect_refusal(label, fn, expect_text=None):
    try:
        fn()
        print(f"  FAIL  {label}\n        it was accepted, but should have been refused")
    except HTTPException as exc:
        if expect_text and expect_text.lower() not in str(exc.detail).lower():
            print(f"  WARN  {label}\n        refused, but said: {exc.detail}")
        else:
            print(f"  PASS  {label}  —  \"{exc.detail}\"")
    except Exception as exc:
        print(f"  FAIL  {label}\n        {type(exc).__name__}: {exc}")


def main():
    db = SessionLocal()
    try:
        print("\n" + "=" * 62)
        print("  PROMOTIONAL CODE — END TO END")
        print("=" * 62 + "\n")

        # Start clean so the script can be run repeatedly.
        db.query(PromoCode).filter(PromoCode.issued_to_email == TEST_EMAIL).delete()
        db.commit()

        print("1. Configured discount")
        percent = promo_service.get_subscriber_percent_off(db)
        print(f"     {percent * 100:.0f}% (from PROMO_SUBSCRIBER_PERCENT_OFF)\n")

        print("2. Subscribing issues a code")
        _, already, promo = newsletter_service.subscribe_with_welcome_code(
            db, email=TEST_EMAIL, first_name="Promo", source="test"
        )
        if not promo:
            print("  FAIL  no code was issued\n")
            return
        print(f"  PASS  issued {promo.code}, expires {promo.expires_at:%d %b %Y}\n")

        print("3. Subscribing again returns the SAME code, not a second one")
        _, _, again = newsletter_service.subscribe_with_welcome_code(db, email=TEST_EMAIL, source="test")
        if again and again.code == promo.code:
            print(f"  PASS  same code returned ({again.code})\n")
        else:
            print(f"  FAIL  a different code was issued: {again.code if again else None}\n")

        print("4. Preview on each part of the business")
        for scope in (PromoScope.HOTEL, PromoScope.RESTAURANT, PromoScope.DELIVERY):
            result = check(
                f"{scope.value:<11} $200 subtotal",
                lambda s=scope: promo_service.validate_code(db, promo.code, s, Decimal("200")),
            )
            if result:
                print(f"        saves ${result['discount_amount']} — \"{result['label']}\"")
        print()

        print("5. A preview must NOT spend the code")
        fresh = db.query(PromoCode).filter(PromoCode.id == promo.id).first()
        db.refresh(fresh)
        if fresh.times_redeemed == 0:
            print("  PASS  still unused after three previews\n")
        else:
            print(f"  FAIL  times_redeemed is {fresh.times_redeemed}, should be 0\n")

        print("6. Bad codes are refused clearly")
        expect_refusal("unknown code", lambda: promo_service.validate_code(db, "NOTACODE", PromoScope.DELIVERY, Decimal("100")), "recognised")
        expect_refusal("empty code", lambda: promo_service.validate_code(db, "", PromoScope.DELIVERY, Decimal("100")), "enter")
        print()

        print("7. Redeeming spends it")
        promo_service.redeem(db, promo_id=promo.id, amount_discounted=Decimal("20.00"))
        db.commit()
        db.refresh(promo)
        print(f"  PASS  times_redeemed is now {promo.times_redeemed} of {promo.max_redemptions}\n")

        print("8. A spent code cannot be used twice")
        expect_refusal(
            "second use",
            lambda: promo_service.validate_code(db, promo.code, PromoScope.DELIVERY, Decimal("100")),
            "already been used",
        )

        print("\n" + "=" * 62)
        print("  Done. Clean up with:  python test_promo.py --clean")
        print("=" * 62 + "\n")

    finally:
        db.close()


def clean():
    db = SessionLocal()
    try:
        from app.models.newsletter import NewsletterSubscriber
        from app.models.promo import PromoRedemption

        codes = db.query(PromoCode).filter(PromoCode.issued_to_email == TEST_EMAIL).all()
        for code in codes:
            db.query(PromoRedemption).filter(PromoRedemption.promo_code_id == code.id).delete()
            db.delete(code)
        db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == TEST_EMAIL).delete()
        db.commit()
        print("\n  Test data removed.\n")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if "--clean" in sys.argv:
        clean()
    else:
        main()
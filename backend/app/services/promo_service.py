"""Promotional codes: issuing them on subscription, validating them at
checkout, and recording redemption.

The discount percentage is a business rule (PROMO_SUBSCRIBER_PERCENT_OFF),
so a manager changes the offer from the Business Rules page rather than
through a deployment — the same pattern as tax and service charge.

Redemption locks the code row FOR UPDATE, so two simultaneous checkouts
cannot both spend a single-use code.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.promo import PromoCode, PromoRedemption, PromoScope
from app.schemas.business_rule_event import RuleLookup
from app.services import business_rule_service

# Unambiguous alphabet: no O/0, I/1, so a code read off a screen or an email
# cannot be mistyped into a different valid code.
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

DEFAULT_PERCENT_OFF = Decimal("0.10")
DEFAULT_VALID_DAYS = 90


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _generate_code(prefix: str = "IHG") -> str:
    body = "".join(secrets.choice(_ALPHABET) for _ in range(6))
    return f"{prefix}{body}"


def get_subscriber_percent_off(db: Session) -> Decimal:
    """The configured subscriber discount. Falls back to 10% if no rule has
    been created yet, so issuing a code never fails on configuration."""
    try:
        return business_rule_service.resolve_rule(
            db, RuleLookup(rule_key="PROMO_SUBSCRIBER_PERCENT_OFF")
        ).value
    except HTTPException:
        return DEFAULT_PERCENT_OFF


def issue_subscriber_code(db: Session, email: str, source: str | None = None) -> PromoCode:
    """Called after a successful newsletter subscription. Idempotent per
    email: re-subscribing returns the existing unused code rather than
    minting a second one."""
    email = (email or "").strip().lower()

    existing = (
        db.query(PromoCode)
        .filter(
            PromoCode.issued_to_email == email,
            PromoCode.is_active == True,  # noqa: E712
            PromoCode.times_redeemed < PromoCode.max_redemptions,
        )
        .order_by(PromoCode.created_at.desc())
        .first()
    )
    if existing and (existing.expires_at is None or existing.expires_at > datetime.now(timezone.utc)):
        return existing

    percent_off = get_subscriber_percent_off(db)

    # Collisions are vanishingly unlikely with 32^6 combinations, but a
    # duplicate code would be a unique-constraint error at checkout time,
    # so retry rather than assume.
    for _ in range(8):
        code = _generate_code()
        if not db.query(PromoCode).filter(PromoCode.code == code).first():
            break
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate a promotional code.")

    promo = PromoCode(
        code=code,
        percent_off=percent_off,
        scope=PromoScope.ANY,
        issued_to_email=email,
        source=source,
        max_redemptions=1,
        times_redeemed=0,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=DEFAULT_VALID_DAYS),
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


def _scope_allows(promo: PromoCode, scope: PromoScope) -> bool:
    return promo.scope == PromoScope.ANY or promo.scope == scope


def validate_code(db: Session, code: str, scope: PromoScope, subtotal: Decimal) -> dict:
    """Checks a code without spending it — used to preview a discount before
    the guest commits. Raises with a clear reason when the code cannot be
    used, so the checkout page can say exactly what is wrong."""
    cleaned = (code or "").strip().upper()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Enter a promotional code.")

    promo = db.query(PromoCode).filter(PromoCode.code == cleaned).first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That code isn't recognised.")
    if not promo.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That code is no longer active.")
    if promo.expires_at and promo.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That code has expired.")
    if promo.times_redeemed >= promo.max_redemptions:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That code has already been used.")
    if not _scope_allows(promo, scope):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"That code can't be used on {scope.value.lower()} orders.",
        )

    percent = Decimal(str(promo.percent_off))
    discount = _round_currency(Decimal(str(subtotal)) * percent)

    return {
        "promo": promo,
        "code": promo.code,
        "percent_off": percent,
        "discount_amount": discount,
        "label": f"{(percent * 100).quantize(Decimal('1'))}% subscriber discount",
    }


def redeem(
    db: Session,
    promo_id: uuid.UUID,
    amount_discounted: Decimal,
    customer_id: uuid.UUID | None = None,
    booking_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> PromoRedemption:
    """Spends one use of a code. The row is locked FOR UPDATE first, so two
    simultaneous checkouts cannot both consume a single-use code. Must be
    called inside the caller's transaction, before its commit."""
    promo = db.query(PromoCode).filter(PromoCode.id == promo_id).with_for_update().first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotional code not found.")
    if promo.times_redeemed >= promo.max_redemptions:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That code has already been used.")

    promo.times_redeemed += 1
    redemption = PromoRedemption(
        promo_code_id=promo.id,
        customer_id=customer_id,
        booking_id=booking_id,
        order_id=order_id,
        amount_discounted=_round_currency(Decimal(str(amount_discounted))),
    )
    db.add(redemption)
    return redemption
"""One-time backfill: migrates Restaurant/Delivery invoice/payment data from
the renamed legacy tables into the unified invoices/payments tables that
already contain Hotel's migrated data.

Usage (from backend/, venv active, backend server STOPPED):
    python backfill_phase14_restaurant.py
"""

import uuid
from decimal import Decimal

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa
from app.models import delivery  # noqa

from app.core.database import SessionLocal
from legacy_models_phase14_restaurant import RestaurantInvoiceLegacy, RestaurantPaymentLegacy
from app.models.billing import Invoice, Payment, InvoiceType, InvoiceStatus, PaymentStatus
from app.models.restaurant import Order, OrderType


def generate_payment_number() -> str:
    return f"PAY{uuid.uuid4().hex[:8].upper()}"


def derive_status(amount_paid: Decimal, total_amount: Decimal) -> InvoiceStatus:
    if amount_paid <= 0:
        return InvoiceStatus.UNPAID
    if amount_paid >= total_amount:
        return InvoiceStatus.PAID
    return InvoiceStatus.PARTIALLY_PAID


def run_backfill():
    db = SessionLocal()
    try:
        legacy_invoices = db.query(RestaurantInvoiceLegacy).all()
        print(f"Found {len(legacy_invoices)} legacy Restaurant/Delivery invoices to migrate.\n")

        old_invoice_total = Decimal("0")
        old_payment_total = Decimal("0")
        old_payment_count = 0

        new_invoice_count = 0
        new_payment_count = 0
        new_invoice_total = Decimal("0")
        new_amount_paid_total = Decimal("0")

        # Breakdown by order type, per the explicit reconciliation requirement.
        breakdown = {
            "DINE_IN": {"invoices": 0, "total": Decimal("0"), "paid": Decimal("0")},
            "DELIVERY": {"invoices": 0, "total": Decimal("0"), "paid": Decimal("0")},
            "UNKNOWN": {"invoices": 0, "total": Decimal("0"), "paid": Decimal("0")},
        }

        discrepancies = []
        missing_orders = []

        for legacy_inv in legacy_invoices:
            old_invoice_total += Decimal(str(legacy_inv.total_amount))

            legacy_payments = db.query(RestaurantPaymentLegacy).filter(
                RestaurantPaymentLegacy.invoice_id == legacy_inv.id
            ).all()

            for lp in legacy_payments:
                old_payment_count += 1
                old_payment_total += Decimal(str(lp.amount))

            order = db.query(Order).filter(Order.id == legacy_inv.order_id).first()
            if not order:
                missing_orders.append(str(legacy_inv.invoice_number))
                order_type_key = "UNKNOWN"
            else:
                order_type_key = order.order_type.value if order.order_type.value in ("DINE_IN", "DELIVERY") else "UNKNOWN"

            new_invoice = Invoice(
                id=legacy_inv.id,
                invoice_number=legacy_inv.invoice_number,
                invoice_type=InvoiceType.RESTAURANT,
                booking_id=None,
                order_id=legacy_inv.order_id,
                restaurant_id=legacy_inv.restaurant_id,
                customer_id=legacy_inv.customer_id,
                room_charge=None,
                service_charge=None,
                subtotal=legacy_inv.subtotal,
                tax_amount=legacy_inv.tax_amount,
                discount_amount=legacy_inv.discount_amount,
                total_amount=legacy_inv.total_amount,
                amount_paid=Decimal("0"),
                status=InvoiceStatus.UNPAID,
                issued_at=legacy_inv.issued_at,
            )
            db.add(new_invoice)
            db.flush()
            new_invoice_count += 1

            completed_total = Decimal("0")
            for lp in legacy_payments:
                new_payment = Payment(
                    id=lp.id,
                    payment_number=generate_payment_number(),
                    invoice_id=new_invoice.id,
                    amount=lp.amount,
                    method=lp.payment_method,
                    status=lp.status,
                    provider="DEMO",
                    provider_reference=lp.transaction_reference,
                    notes="Migrated from legacy Restaurant/Delivery payment record (Phase 14 backfill).",
                    created_by=None,
                    paid_at=lp.paid_at,
                )
                db.add(new_payment)
                new_payment_count += 1

                if new_payment.status == PaymentStatus.COMPLETED:
                    completed_total += Decimal(str(lp.amount))

            new_invoice.amount_paid = completed_total
            new_invoice.status = derive_status(completed_total, Decimal(str(legacy_inv.total_amount)))

            new_invoice_total += Decimal(str(legacy_inv.total_amount))
            new_amount_paid_total += completed_total

            breakdown[order_type_key]["invoices"] += 1
            breakdown[order_type_key]["total"] += Decimal(str(legacy_inv.total_amount))
            breakdown[order_type_key]["paid"] += completed_total

            legacy_status_str = legacy_inv.status.value if hasattr(legacy_inv.status, "value") else str(legacy_inv.status)
            if legacy_status_str != new_invoice.status.value:
                discrepancies.append(
                    f"  Invoice {legacy_inv.invoice_number}: legacy status was "
                    f"'{legacy_status_str}', recomputed status is '{new_invoice.status.value}' "
                    f"(amount_paid={completed_total}, total={legacy_inv.total_amount})"
                )

        db.commit()

        print("=" * 70)
        print("RECONCILIATION REPORT — Restaurant/Delivery")
        print("=" * 70)
        print(f"Legacy invoices found:        {len(legacy_invoices)}")
        print(f"New invoices created:         {new_invoice_count}")
        print(f"Legacy payments found:        {old_payment_count}")
        print(f"New payments created:         {new_payment_count}")
        print()
        print(f"Legacy invoice total_amount SUM:  {old_invoice_total}")
        print(f"New invoice total_amount SUM:     {new_invoice_total}")
        print(f"Match: {old_invoice_total == new_invoice_total}")
        print()
        print(f"Legacy payment amount SUM (all):  {old_payment_total}")
        print(f"New amount_paid SUM (COMPLETED only): {new_amount_paid_total}")
        print()
        print("Breakdown by order type:")
        for key, vals in breakdown.items():
            print(f"  {key}: {vals['invoices']} invoices, total={vals['total']}, paid={vals['paid']}")
        print()

        if missing_orders:
            print(f"[WARNING] {len(missing_orders)} invoices reference an order that no longer exists:")
            for m in missing_orders:
                print(f"  {m}")
            print()

        if discrepancies:
            print(f"[WARNING] {len(discrepancies)} STATUS DISCREPANCIES FOUND (review before proceeding):")
            for d in discrepancies:
                print(d)
        else:
            print("OK - No status discrepancies. Every recomputed status matches the legacy status.")

        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"BACKFILL FAILED, rolled back: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_backfill()
import uuid
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.hotel import Booking, Room
from app.models.billing import Invoice, InvoiceType, InvoiceStatus, Payment, PaymentStatus
from app.models.service_request import ServiceRequest, ServiceRequestStatus
from app.models.user import User
from app.schemas.billing import PaymentCreate
from app.services import audit_service


def _round_currency(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def generate_invoice_number() -> str:
    return f"INV{uuid.uuid4().hex[:8].upper()}"


def generate_payment_number() -> str:
    return f"PAY{uuid.uuid4().hex[:8].upper()}"


def generate_invoice_for_booking(db: Session, booking: Booking) -> Invoice:
    existing = db.query(Invoice).filter(Invoice.booking_id == booking.id).first()
    if existing:
        return existing

    room_charge = Decimal(str(booking.total_amount))

    billable_requests = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.booking_id == booking.id,
            ServiceRequest.status == ServiceRequestStatus.COMPLETED,
            ServiceRequest.price.isnot(None),
        )
        .all()
    )
    service_charge = sum((Decimal(str(r.price)) for r in billable_requests), Decimal("0"))

    subtotal = room_charge + service_charge
    tax_amount = _round_currency(subtotal * Decimal(str(settings.tax_rate)))
    discount_amount = Decimal("0")
    total_amount = _round_currency(subtotal + tax_amount - discount_amount)

    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        invoice_type=InvoiceType.HOTEL,
        booking_id=booking.id,
        customer_id=booking.guest_id,
        room_charge=room_charge,
        service_charge=service_charge,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0"),
        status=InvoiceStatus.UNPAID,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    audit_service.log_action(
        db, booking.guest_id, "GENERATE_INVOICE", "invoice", invoice.id,
        f"Auto-generated invoice {invoice.invoice_number} for booking {booking.booking_reference}",
    )
    return invoice


def _attach_display_fields(db: Session, invoice: Invoice) -> Invoice:
    invoice.remaining_balance = float(Decimal(str(invoice.total_amount)) - Decimal(str(invoice.amount_paid)))
    if invoice.invoice_type == InvoiceType.HOTEL and invoice.booking_id:
        booking = db.query(Booking).filter(Booking.id == invoice.booking_id).first()
        if booking:
            invoice.booking_reference = booking.booking_reference
            room = db.query(Room).filter(Room.id == booking.room_id).first()
            if room:
                invoice.room_number = room.room_number
    return invoice


def get_invoice_or_404(db: Session, invoice_id: uuid.UUID) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return invoice


def get_invoice_for_booking(db: Session, booking_id: uuid.UUID, current_user: User) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.booking_id == booking_id, Invoice.invoice_type == InvoiceType.HOTEL).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No invoice exists for this booking yet.")

    if current_user.role.value == "CUSTOMER" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own invoice.")

    return _attach_display_fields(db, invoice)


def list_my_invoices(db: Session, guest_id: uuid.UUID) -> list[Invoice]:
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == guest_id, Invoice.invoice_type == InvoiceType.HOTEL)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def list_all_invoices(db: Session) -> list[Invoice]:
    invoices = (
        db.query(Invoice)
        .filter(Invoice.invoice_type == InvoiceType.HOTEL)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def pay_invoice(db: Session, invoice_id: uuid.UUID, guest: User, data: PaymentCreate) -> Payment:
    # Row-level lock: if two requests try to pay the same invoice at once,
    # the second one blocks here until the first transaction commits, then
    # reloads the up-to-date amount_paid before validating remaining balance.
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .with_for_update()
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    if invoice.customer_id != guest.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only pay your own invoice.")

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This invoice is already paid.")

    total_amount = Decimal(str(invoice.total_amount))
    already_paid = Decimal(str(invoice.amount_paid))
    remaining = total_amount - already_paid

    amount = Decimal(str(data.amount)) if data.amount is not None else remaining
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Payment amount must be greater than zero.")
    if amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Payment amount exceeds remaining invoice balance (${remaining}).",
        )

    payment = Payment(
        payment_number=generate_payment_number(),
        invoice_id=invoice.id,
        amount=amount,
        method=data.payment_method,
        status=PaymentStatus.COMPLETED,  # demo mode: always succeeds
        provider="DEMO",
        provider_reference=f"DEMO-{uuid.uuid4().hex[:10].upper()}",
        created_by=guest.id,
    )
    db.add(payment)

    new_amount_paid = already_paid + amount
    invoice.amount_paid = new_amount_paid
    invoice.status = InvoiceStatus.PAID if new_amount_paid >= total_amount else InvoiceStatus.PARTIALLY_PAID

    db.commit()
    db.refresh(payment)

    audit_service.log_action(
        db, guest.id, "PAY_INVOICE", "invoice", invoice.id,
        f"Paid ${amount} on invoice {invoice.invoice_number} ({data.payment_method.value}) — status now {invoice.status.value}",
    )
    return payment
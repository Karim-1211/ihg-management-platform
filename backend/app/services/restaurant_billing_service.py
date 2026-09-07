import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.restaurant import Order, RestaurantTable
from app.models.billing import Invoice, InvoiceType, InvoiceStatus, Payment, PaymentStatus
from app.models.user import User
from app.schemas.restaurant_billing import RestaurantPaymentCreate
from app.schemas.notification_event import NotificationEvent
from app.models.notification import NotificationType
from app.services.restaurant_service import assert_restaurant_access
from app.services import audit_service
from app.services import notification_service


def generate_invoice_number() -> str:
    return f"RINV{uuid.uuid4().hex[:8].upper()}"


def generate_payment_number() -> str:
    return f"PAY{uuid.uuid4().hex[:8].upper()}"


def generate_invoice_for_order(db: Session, order: Order) -> Invoice:
    """Called automatically when an order is marked SERVED. Idempotent: returns the
    existing invoice if one already exists for this order rather than duplicating.
    Amounts are copied from the order's already-finalized totals — never recalculated
    from current menu prices, since the order is the historical source of truth."""
    existing = db.query(Invoice).filter(Invoice.order_id == order.id, Invoice.invoice_type == InvoiceType.RESTAURANT).first()
    if existing:
        return existing
    invoice = Invoice(
        invoice_number=generate_invoice_number(),
        invoice_type=InvoiceType.RESTAURANT,
        order_id=order.id,
        restaurant_id=order.restaurant_id,
        customer_id=order.customer_id,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        amount_paid=Decimal("0"),
        status=InvoiceStatus.UNPAID,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    audit_service.log_action(
        db, order.customer_id, "GENERATE_RESTAURANT_INVOICE", "invoice", invoice.id,
        f"Auto-generated invoice {invoice.invoice_number} for order {order.order_number}",
    )
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.INVOICE_CREATED,
        entity_type="invoice",
        entity_id=invoice.id,
        restaurant_id=order.restaurant_id,
        metadata={
            "customer_id": str(order.customer_id) if order.customer_id else None,
            "invoice_number": invoice.invoice_number,
            "total_amount": str(invoice.total_amount),
        },
    ))
    return invoice


def _attach_display_fields(db: Session, invoice: Invoice) -> Invoice:
    invoice.remaining_balance = float(Decimal(str(invoice.total_amount)) - Decimal(str(invoice.amount_paid)))
    if invoice.order_id:
        order = db.query(Order).filter(Order.id == invoice.order_id).first()
        if order:
            invoice.order_number = order.order_number
            if order.table_id:
                table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
                if table:
                    invoice.table_number = table.table_number
    return invoice


def get_invoice_or_404(db: Session, invoice_id: uuid.UUID) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.invoice_type == InvoiceType.RESTAURANT).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return invoice


def get_invoice_for_order(db: Session, order_id: uuid.UUID, current_user: User) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.order_id == order_id, Invoice.invoice_type == InvoiceType.RESTAURANT).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No invoice exists for this order yet.")
    is_owner = invoice.customer_id is not None and invoice.customer_id == current_user.id
    if current_user.role.value == "CUSTOMER" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own invoice.")
    return _attach_display_fields(db, invoice)


def list_my_invoices(db: Session, customer_id: uuid.UUID) -> list[Invoice]:
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer_id, Invoice.invoice_type == InvoiceType.RESTAURANT)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def list_invoices_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[Invoice]:
    assert_restaurant_access(db, current_user, restaurant_id)
    invoices = (
        db.query(Invoice)
        .filter(Invoice.restaurant_id == restaurant_id, Invoice.invoice_type == InvoiceType.RESTAURANT)
        .order_by(Invoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def pay_invoice(db: Session, invoice_id: uuid.UUID, current_user: User, data: RestaurantPaymentCreate) -> Payment:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.invoice_type == InvoiceType.RESTAURANT)
        .with_for_update()
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    is_owner = invoice.customer_id is not None and invoice.customer_id == current_user.id
    is_staff = current_user.role.value in ("SUPER_ADMIN", "MANAGER", "WAITER")
    if current_user.role.value == "CUSTOMER" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only pay your own invoice.")
    if not is_owner and not is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to process this payment.")
    if is_staff and current_user.role.value == "MANAGER":
        assert_restaurant_access(db, current_user, invoice.restaurant_id)
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
        created_by=current_user.id,
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    new_amount_paid = already_paid + amount
    invoice.amount_paid = new_amount_paid
    invoice.status = InvoiceStatus.PAID if new_amount_paid >= total_amount else InvoiceStatus.PARTIALLY_PAID
    db.commit()
    db.refresh(payment)
    audit_service.log_action(
        db, current_user.id, "PAY_RESTAURANT_INVOICE", "invoice", invoice.id,
        f"Paid ${amount} on invoice {invoice.invoice_number} ({data.payment_method.value}) — status now {invoice.status.value}",
    )
    payment_customer_id = invoice.customer_id if invoice.customer_id else current_user.id
    notification_service.dispatch(db, NotificationEvent(
        event_type=NotificationType.PAYMENT_COMPLETED,
        actor_user_id=current_user.id,
        entity_type="payment",
        entity_id=payment.id,
        restaurant_id=invoice.restaurant_id,
        metadata={
            "customer_id": str(payment_customer_id),
            "amount": str(amount),
            "invoice_number": invoice.invoice_number,
        },
    ))
    return payment
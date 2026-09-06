import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.restaurant import Order, RestaurantTable
from app.models.restaurant_billing import RestaurantInvoice, RestaurantPayment
from app.models.billing import InvoiceStatus, PaymentStatus
from app.models.user import User
from app.schemas.restaurant_billing import RestaurantPaymentCreate
from app.services.restaurant_service import assert_restaurant_access
from app.services import audit_service


def generate_invoice_number() -> str:
    return f"RINV{uuid.uuid4().hex[:8].upper()}"


def generate_invoice_for_order(db: Session, order: Order) -> RestaurantInvoice:
    """Called automatically when an order is marked SERVED. Idempotent: returns the
    existing invoice if one already exists for this order rather than duplicating.
    Amounts are copied from the order's already-finalized totals — never recalculated
    from current menu prices, since the order is the historical source of truth."""
    existing = db.query(RestaurantInvoice).filter(RestaurantInvoice.order_id == order.id).first()
    if existing:
        return existing

    invoice = RestaurantInvoice(
        invoice_number=generate_invoice_number(),
        order_id=order.id,
        restaurant_id=order.restaurant_id,
        customer_id=order.customer_id,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        status=InvoiceStatus.UNPAID,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    audit_service.log_action(
        db, order.customer_id, "GENERATE_RESTAURANT_INVOICE", "restaurant_invoice", invoice.id,
        f"Auto-generated invoice {invoice.invoice_number} for order {order.order_number}",
    )
    return invoice


def _attach_display_fields(db: Session, invoice: RestaurantInvoice) -> RestaurantInvoice:
    order = db.query(Order).filter(Order.id == invoice.order_id).first()
    if order:
        invoice.order_number = order.order_number
        if order.table_id:
            table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
            if table:
                invoice.table_number = table.table_number
    return invoice


def get_invoice_or_404(db: Session, invoice_id: uuid.UUID) -> RestaurantInvoice:
    invoice = db.query(RestaurantInvoice).filter(RestaurantInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return invoice


def get_invoice_for_order(db: Session, order_id: uuid.UUID, current_user: User) -> RestaurantInvoice:
    invoice = db.query(RestaurantInvoice).filter(RestaurantInvoice.order_id == order_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No invoice exists for this order yet.")

    is_owner = invoice.customer_id is not None and invoice.customer_id == current_user.id
    if current_user.role.value == "CUSTOMER" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own invoice.")

    return _attach_display_fields(db, invoice)


def list_my_invoices(db: Session, customer_id: uuid.UUID) -> list[RestaurantInvoice]:
    invoices = (
        db.query(RestaurantInvoice)
        .filter(RestaurantInvoice.customer_id == customer_id)
        .order_by(RestaurantInvoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def list_invoices_for_restaurant(db: Session, current_user: User, restaurant_id: uuid.UUID) -> list[RestaurantInvoice]:
    assert_restaurant_access(db, current_user, restaurant_id)
    invoices = (
        db.query(RestaurantInvoice)
        .filter(RestaurantInvoice.restaurant_id == restaurant_id)
        .order_by(RestaurantInvoice.issued_at.desc())
        .all()
    )
    return [_attach_display_fields(db, i) for i in invoices]


def pay_invoice(db: Session, invoice_id: uuid.UUID, current_user: User, data: RestaurantPaymentCreate) -> RestaurantPayment:
    invoice = get_invoice_or_404(db, invoice_id)

    is_owner = invoice.customer_id is not None and invoice.customer_id == current_user.id
    is_staff = current_user.role.value in ("SUPER_ADMIN", "MANAGER", "WAITER")

    if current_user.role.value == "CUSTOMER" and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only pay your own invoice.")
    if not is_owner and not is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to process this payment.")
    if is_staff and current_user.role.value in ("MANAGER",):
        assert_restaurant_access(db, current_user, invoice.restaurant_id)

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This invoice is already paid.")

    payment = RestaurantPayment(
        invoice_id=invoice.id,
        amount=invoice.total_amount,
        payment_method=data.payment_method,
        status=PaymentStatus.SUCCESS,
        transaction_reference=f"DEMO-{uuid.uuid4().hex[:10].upper()}",
    )
    db.add(payment)

    invoice.status = InvoiceStatus.PAID
    db.commit()
    db.refresh(payment)

    audit_service.log_action(
        db, current_user.id, "PAY_RESTAURANT_INVOICE", "restaurant_invoice", invoice.id,
        f"Paid invoice {invoice.invoice_number} (${payment.amount}, {data.payment_method.value})",
    )
    return payment
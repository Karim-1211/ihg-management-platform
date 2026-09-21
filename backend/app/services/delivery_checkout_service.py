"""Delivery quote and pay-at-checkout.

Built entirely on existing, tested services:
  * pricing        -> order_service.price_order_lines (same code path as create_order)
  * order creation -> order_service.create_order
  * invoicing      -> restaurant_billing_service.generate_invoice_for_order
  * payment        -> restaurant_billing_service.pay_invoice

generate_invoice_for_order is idempotent, so when the order is later marked
SERVED on delivery, it returns this already-paid invoice instead of creating
a second one — the guest is never billed twice.
"""
from types import SimpleNamespace

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.delivery import Delivery
from app.models.restaurant import MenuCategory, MenuItem, OrderType
from app.models.user import RoleEnum, User
from app.schemas.delivery_checkout import (
    CHECKOUT_PAYMENT_METHODS,
    DeliveryCheckoutRequest,
    DeliveryCheckoutResponse,
    DeliveryQuoteLine,
    DeliveryQuoteRequest,
    DeliveryQuoteResponse,
)
from app.schemas.restaurant import OrderCreate, OrderItemCreate
from app.services import order_service, restaurant_billing_service
from app.services.restaurant_service import get_restaurant_or_404


def _merge_lines(lines) -> list[OrderItemCreate]:
    """Collapse duplicate dishes into one line each."""
    merged: dict = {}
    for line in lines:
        merged[line.menu_item_id] = merged.get(line.menu_item_id, 0) + line.quantity
    return [OrderItemCreate(menu_item_id=item_id, quantity=qty) for item_id, qty in merged.items()]


def quote_delivery(db: Session, data: DeliveryQuoteRequest) -> DeliveryQuoteResponse:
    """Prices a basket without creating anything. Dishes that no longer
    exist, aren't on this restaurant's menu, or are currently unavailable are
    reported back rather than failing the whole quote, so the checkout page
    can tell the guest exactly what changed."""
    restaurant = get_restaurant_or_404(db, data.restaurant_id)

    orderable: list[OrderItemCreate] = []
    unavailable = []
    for line in _merge_lines(data.items):
        item = db.query(MenuItem).filter(MenuItem.id == line.menu_item_id).first()
        category = db.query(MenuCategory).filter(MenuCategory.id == item.category_id).first() if item else None
        if not item or not item.is_available or not category or category.restaurant_id != restaurant.id:
            unavailable.append(line.menu_item_id)
            continue
        orderable.append(line)

    if not orderable:
        return DeliveryQuoteResponse(
            restaurant_id=restaurant.id, lines=[], unavailable_item_ids=unavailable,
            subtotal=0, tax_amount=0, service_charge_amount=0, discount_amount=0, total_amount=0,
        )

    pricing = order_service.price_order_lines(db, restaurant.id, orderable)
    names = {
        mi.id: mi.name
        for mi in db.query(MenuItem).filter(MenuItem.id.in_([line.menu_item_id for line in orderable])).all()
    }
    lines = [
        DeliveryQuoteLine(
            menu_item_id=oi.menu_item_id,
            name=names.get(oi.menu_item_id, "Item"),
            quantity=oi.quantity,
            unit_price=float(oi.unit_price),
            subtotal=float(oi.subtotal),
        )
        for oi in pricing["order_items"]
    ]

    return DeliveryQuoteResponse(
        restaurant_id=restaurant.id,
        lines=lines,
        unavailable_item_ids=unavailable,
        subtotal=float(pricing["subtotal"]),
        tax_amount=float(pricing["tax_amount"]),
        service_charge_amount=float(pricing["service_charge_amount"]),
        discount_amount=float(pricing["discount_amount"]),
        total_amount=float(pricing["total_amount"]),
    )


def checkout_delivery(db: Session, current_user: User, data: DeliveryCheckoutRequest) -> DeliveryCheckoutResponse:
    if current_user.role != RoleEnum.CUSTOMER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only guest accounts can place delivery orders.")
    if data.payment_method not in CHECKOUT_PAYMENT_METHODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Please choose Visa, Mastercard or PayPal.")

    order = order_service.create_order(db, current_user, OrderCreate(
        restaurant_id=data.restaurant_id,
        order_type=OrderType.DELIVERY,
        delivery_address=data.delivery_address,
        items=_merge_lines(data.items),
    ))

    # The rider's contact details live on the existing Delivery record.
    contact = [f"Phone: {data.contact_phone}"]
    if data.delivery_notes and data.delivery_notes.strip():
        contact.append(f"Notes: {data.delivery_notes.strip()}")
    delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()
    if delivery:
        delivery.notes = "\n".join(contact)
        db.commit()

    invoice = restaurant_billing_service.generate_invoice_for_order(db, order)
    payment = restaurant_billing_service.pay_invoice(
        db, invoice.id, current_user,
        SimpleNamespace(payment_method=data.payment_method, amount=None),  # None = pay the full balance
    )

    return DeliveryCheckoutResponse(
        order_id=order.id,
        order_number=order.order_number,
        total_amount=float(order.total_amount),
        invoice_number=invoice.invoice_number,
        payment_number=payment.payment_number,
        payment_status=payment.status.value,
        payment_method=payment.method.value,
    )
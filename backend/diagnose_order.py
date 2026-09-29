"""Prints an order's real stored lines so a suspicious total can be checked
against the data rather than guessed at.

Run from backend/:
    python diagnose_order.py ORDC4A0A5F7
    python diagnose_order.py --odd      (lists every order over $1,000)
"""
import sys
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.restaurant import MenuItem, Order, OrderItem
from app.models.user import User  # noqa: F401


def show(db, order):
    customer = db.query(User).filter(User.id == order.customer_id).first() if order.customer_id else None
    print("=" * 66)
    print(f"  {order.order_number}   {order.order_type.value}   {order.status.value}")
    print(f"  Placed {order.created_at}")
    if customer:
        print(f"  Customer: {customer.first_name} {customer.last_name} <{customer.email}>")
    print("=" * 66)

    lines = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    print(f"\n  {len(lines)} line(s):\n")
    computed = Decimal("0")
    for line in lines:
        item = db.query(MenuItem).filter(MenuItem.id == line.menu_item_id).first()
        name = item.name if item else "(deleted menu item)"
        line_total = Decimal(str(line.subtotal))
        computed += line_total
        flag = "   <-- unusually large quantity" if line.quantity > 20 else ""
        print(f"    {line.quantity:>5} x {name:<34} @ {line.unit_price:>8}  = {line_total:>12}{flag}")

    print(f"\n    {'Computed from lines':<44} {computed:>14}")
    print(f"    {'Stored subtotal':<44} {order.subtotal:>14}")
    print(f"    {'Tax':<44} {order.tax_amount:>14}")
    print(f"    {'Service charge':<44} {order.service_charge_amount:>14}")
    print(f"    {'Stored TOTAL':<44} {order.total_amount:>14}\n")

    if computed != Decimal(str(order.subtotal)):
        print("  The stored subtotal does NOT match the lines — a real inconsistency.\n")
    else:
        print("  The total is consistent with the lines: the quantity produced it,")
        print("  not a rounding or display fault.\n")


def main():
    db = SessionLocal()
    try:
        if len(sys.argv) > 1 and sys.argv[1] != "--odd":
            order = db.query(Order).filter(Order.order_number == sys.argv[1].strip()).first()
            if not order:
                print(f"No order found with number '{sys.argv[1]}'.")
                return
            show(db, order)
            return

        big = db.query(Order).filter(Order.total_amount > 1000).order_by(Order.total_amount.desc()).all()
        if not big:
            print("\n  No order exceeds $1,000 — nothing looks out of place.\n")
            return
        print(f"\n  {len(big)} order(s) over $1,000:\n")
        for order in big:
            print(f"    {order.order_number}  {order.total_amount:>14}  {order.status.value}")
        print("\n  Inspect one with:  python diagnose_order.py <ORDER_NUMBER>\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
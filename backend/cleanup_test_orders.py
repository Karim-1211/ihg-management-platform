"""Removes cancelled test orders — the kind left over from early testing,
such as a mistyped quantity of 1000.

Safe by design: shows exactly what would go before anything is deleted,
refuses to touch any order that has an invoice or that moved stock, and
only ever considers CANCELLED orders (a cancelled order never reached the
kitchen, so it has no operational history worth keeping).

Run from backend/:
    python cleanup_test_orders.py              # report only, deletes nothing
    python cleanup_test_orders.py --delete     # actually delete
    python cleanup_test_orders.py --delete ORDC4A0A5F7
"""
import sys

from app.core.database import SessionLocal
from app.models.billing import Invoice
from app.models.delivery import Delivery
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.inventory import StockTransaction
from app.models.restaurant import MenuItem, Order, OrderItem, OrderStatus
from app.models.user import User  # noqa: F401


def blockers(db, order) -> list[str]:
    """Anything that makes an order real history rather than test noise."""
    reasons = []
    if db.query(Invoice).filter(Invoice.order_id == order.id).first():
        reasons.append("has an invoice")
    if db.query(StockTransaction).filter(
        StockTransaction.reference_type == "order", StockTransaction.reference_id == order.id
    ).first():
        reasons.append("moved inventory")
    return reasons


def describe(db, order) -> str:
    lines = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    parts = []
    for line in lines[:3]:
        item = db.query(MenuItem).filter(MenuItem.id == line.menu_item_id).first()
        parts.append(f"{line.quantity}x {item.name if item else 'deleted item'}")
    if len(lines) > 3:
        parts.append(f"+{len(lines) - 3} more")
    return ", ".join(parts) or "no lines"


def main():
    args = [a for a in sys.argv[1:]]
    do_delete = "--delete" in args
    wanted = [a for a in args if not a.startswith("--")]

    db = SessionLocal()
    try:
        query = db.query(Order).filter(Order.status == OrderStatus.CANCELLED)
        if wanted:
            query = query.filter(Order.order_number.in_(wanted))
        orders = query.order_by(Order.created_at).all()

        if not orders:
            print("\n  No cancelled orders found.\n")
            return

        removable, kept = [], []
        for order in orders:
            reasons = blockers(db, order)
            (kept if reasons else removable).append((order, reasons))

        print(f"\n  {len(orders)} cancelled order(s) examined\n")

        if kept:
            print("  KEEPING — these have real history:\n")
            for order, reasons in kept:
                print(f"    {order.order_number:<14} ${float(order.total_amount):>10,.2f}   {', '.join(reasons)}")
            print()

        if not removable:
            print("  Nothing is safe to remove.\n")
            return

        print("  SAFE TO REMOVE:\n")
        for order, _ in removable:
            print(f"    {order.order_number:<14} ${float(order.total_amount):>10,.2f}   {describe(db, order)}")
            print(f"    {'':<14} placed {order.created_at:%d %b %Y}")
        print()

        if not do_delete:
            print("  Nothing was deleted. Re-run with --delete to remove the orders above.\n")
            return

        for order, _ in removable:
            db.query(Delivery).filter(Delivery.order_id == order.id).delete(synchronize_session=False)
            db.query(OrderItem).filter(OrderItem.order_id == order.id).delete(synchronize_session=False)
            db.delete(order)
        db.commit()
        print(f"  Deleted {len(removable)} cancelled order(s).\n")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
"""Isolated verification of Phase 18.7B RESTAURANT_SERVICE_CHARGE_RATE.
Proves: (1) default 0% produces zero behavior change, (2) a nonzero rate
calculates correctly and flows through to the invoice, (3) the rate is
restored to 0 afterward so regression scripts are unaffected."""

from decimal import Decimal, ROUND_HALF_UP

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.business_rule import BusinessRule, RuleStatus
from app.models.restaurant import Order, OrderItem, OrderStatus, RestaurantTable, MenuItem
from app.models.billing import Invoice
from app.models.user import User, RoleEnum
from app.schemas.restaurant import OrderCreate, OrderItemCreate
from app.services import order_service, restaurant_billing_service


def get_rule(db, rule_key):
    return db.query(BusinessRule).filter(BusinessRule.rule_key == rule_key, BusinessRule.status == RuleStatus.ACTIVE).first()


def round_currency(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def run():
    db = SessionLocal()
    passed = 0
    failed = 0
    created_order_ids = []

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    original_rate = None

    try:
        print("0. Loading real customer, an available DINE_IN table, and a menu item...")
        customer = db.query(User).filter(User.role == RoleEnum.CUSTOMER).first()
        table = db.query(RestaurantTable).first()
        menu_item = db.query(MenuItem).filter(MenuItem.is_available == True).first()  # noqa: E712
        if not customer or not table or not menu_item:
            print("   ABORT - missing customer/table/menu item in database.")
            return
        print(f"   customer: {customer.email}, table: {table.table_number}, item: {menu_item.name} (${menu_item.price})")

        rate_rule = get_rule(db, "RESTAURANT_SERVICE_CHARGE_RATE")
        if not rate_rule:
            print("   ABORT - RESTAURANT_SERVICE_CHARGE_RATE rule not found. Run the seed script first.")
            return
        original_rate = rate_rule.numeric_value

        print("\n1. With default rate (0%), confirm a new order has service_charge_amount = 0...")
        order1 = order_service.create_order(db, customer, OrderCreate(
            restaurant_id=table.restaurant_id, order_type="DINE_IN", table_id=table.id,
            items=[OrderItemCreate(menu_item_id=menu_item.id, quantity=1)],
        ))
        created_order_ids.append(order1.id)
        check("service_charge_amount is 0 at default rate", Decimal(str(order1.service_charge_amount)) == Decimal("0.00"))
        expected_total_no_charge = round_currency(Decimal(str(order1.subtotal)) + Decimal(str(order1.tax_amount)))
        check("total_amount unaffected by 0% service charge", Decimal(str(order1.total_amount)) == expected_total_no_charge)

        print("\n2. Raise rate to 10%, confirm a new order's service_charge_amount is calculated correctly...")
        rate_rule.numeric_value = Decimal("0.10")
        db.commit()

        order2 = order_service.create_order(db, customer, OrderCreate(
            restaurant_id=table.restaurant_id, order_type="DINE_IN", table_id=table.id,
            items=[OrderItemCreate(menu_item_id=menu_item.id, quantity=2)],
        ))
        created_order_ids.append(order2.id)

        subtotal2 = Decimal(str(order2.subtotal))
        expected_charge = round_currency(subtotal2 * Decimal("0.10"))
        expected_total2 = round_currency(subtotal2 + Decimal(str(order2.tax_amount)) + expected_charge)
        check("service_charge_amount == subtotal * 0.10 exactly", Decimal(str(order2.service_charge_amount)) == expected_charge)
        check("total_amount == subtotal + tax + service_charge exactly", Decimal(str(order2.total_amount)) == expected_total2)

        print("\n3. Advance order2 to SERVED, confirm the generated invoice carries the same service_charge...")
        invoice = restaurant_billing_service.generate_invoice_for_order(db, order2)
        check("invoice.service_charge matches order.service_charge_amount", Decimal(str(invoice.service_charge)) == expected_charge)
        check("invoice.total_amount matches order.total_amount", Decimal(str(invoice.total_amount)) == expected_total2)

    finally:
        if original_rate is not None:
            rate_rule = get_rule(db, "RESTAURANT_SERVICE_CHARGE_RATE")
            if rate_rule and rate_rule.numeric_value != original_rate:
                rate_rule.numeric_value = original_rate
                db.commit()

        # Delete in correct dependency order: Invoice -> OrderItem -> Order.
        for oid in created_order_ids:
            db.query(Invoice).filter(Invoice.order_id == oid).delete(synchronize_session=False)
            db.query(OrderItem).filter(OrderItem.order_id == oid).delete(synchronize_session=False)
            db.query(Order).filter(Order.id == oid).delete(synchronize_session=False)
        db.commit()
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL SERVICE CHARGE TESTS PASSED")


if __name__ == "__main__":
    run()
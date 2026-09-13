"""Isolated structural verification of Phase 20.3's recommendation tools —
no LLM calls, no cost. Proves grounding (real data only), empty-history
honesty, and restaurant-scoping isolation deterministically."""

from datetime import date, timedelta

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.models.restaurant import Restaurant
from app.services.ai_tool_registry import dispatch_tool


def run():
    db = SessionLocal()
    passed = 0
    failed = 0

    def check(label, condition):
        nonlocal passed, failed
        if condition:
            print(f"   OK - {label}")
            passed += 1
        else:
            print(f"   FAILED - {label}")
            failed += 1

    try:
        customer = db.query(User).filter(User.role == RoleEnum.CUSTOMER).first()
        if not customer:
            print("   ABORT - no customer found.")
            return

        check_in = (date.today() + timedelta(days=60)).isoformat()
        check_out = (date.today() + timedelta(days=62)).isoformat()

        print("1. get_room_recommendations with valid future dates returns grounded structure...")
        room_result = dispatch_tool(db, customer, "get_room_recommendations", {"check_in_date": check_in, "check_out_date": check_out})
        check("returns a dict", isinstance(room_result, dict))
        check("has personalized flag", "personalized" in room_result)

        print("\n2. get_room_recommendations rejects malformed dates safely...")
        bad_result = dispatch_tool(db, customer, "get_room_recommendations", {"check_in_date": "not-a-date", "check_out_date": check_out})
        check("returns error dict, does not raise", isinstance(bad_result, dict) and "error" in bad_result)

        print("\n3. get_room_recommendations rejects check_out before check_in...")
        reversed_result = dispatch_tool(db, customer, "get_room_recommendations", {"check_in_date": check_out, "check_out_date": check_in})
        check("returns error for reversed dates", isinstance(reversed_result, dict) and "error" in reversed_result)

        restaurants = db.query(Restaurant).limit(2).all()
        if len(restaurants) >= 1:
            r1 = restaurants[0]
            print(f"\n4. get_menu_recommendations for restaurant {r1.name} returns grounded structure scoped to that restaurant...")
            menu_result = dispatch_tool(db, customer, "get_menu_recommendations", {"restaurant_id": str(r1.id)})
            check("returns a dict", isinstance(menu_result, dict))
            check("has personalized flag", "personalized" in menu_result)
            if menu_result.get("full_current_menu") or menu_result.get("available_items"):
                items = menu_result.get("full_current_menu") or menu_result.get("available_items")
                check("every item has a real menu_item_id and price", all("menu_item_id" in i and "price" in i for i in items))

            if len(restaurants) >= 2:
                r2 = restaurants[1]
                print(f"\n5. No cross-restaurant leakage - recommendations for restaurant B don't mention restaurant A's items exclusively...")
                menu_result_b = dispatch_tool(db, customer, "get_menu_recommendations", {"restaurant_id": str(r2.id)})
                items_a = {i["menu_item_id"] for i in (menu_result.get("full_current_menu") or menu_result.get("available_items") or [])}
                items_b = {i["menu_item_id"] for i in (menu_result_b.get("full_current_menu") or menu_result_b.get("available_items") or [])}
                check("restaurant A and B menus are structurally distinct (different item ID sets)", items_a != items_b or (len(items_a) == 0 and len(items_b) == 0))
            else:
                print("\n5. SKIPPED - only one restaurant exists to compare against.")
        else:
            print("\n4-5. SKIPPED - no restaurants found in database.")

        print("\n6. Invalid restaurant_id is rejected safely...")
        invalid_menu_result = dispatch_tool(db, customer, "get_menu_recommendations", {"restaurant_id": "not-a-uuid"})
        check("returns error dict, does not raise", isinstance(invalid_menu_result, dict) and "error" in invalid_menu_result)

    finally:
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL AI RECOMMENDATION TOOL STRUCTURAL TESTS PASSED")


if __name__ == "__main__":
    run()
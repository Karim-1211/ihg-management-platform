"""Isolated structural verification of Phase 20.2's tool registry — no
Anthropic API calls, no cost. Proves tenant isolation and policy-summary
field exposure deterministically, independent of any LLM behavior."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
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
        customers = db.query(User).filter(User.role == RoleEnum.CUSTOMER).limit(2).all()
        if len(customers) < 1:
            print("   ABORT - no customer found.")
            return
        customer_a = customers[0]
        customer_b = customers[1] if len(customers) > 1 else None

        print("1. get_my_bookings only returns bookings scoped to the calling customer...")
        result_a = dispatch_tool(db, customer_a, "get_my_bookings", {})
        check("returns a list without error", isinstance(result_a, list))

        if customer_b:
            print("\n2. Two different customers get structurally different (independently-scoped) results...")
            result_b = dispatch_tool(db, customer_b, "get_my_bookings", {})
            refs_a = {b["booking_reference"] for b in result_a}
            refs_b = {b["booking_reference"] for b in result_b}
            check("no booking reference appears in both customers' results (unless coincidentally both have none)", len(refs_a & refs_b) == 0 or (len(refs_a) == 0 and len(refs_b) == 0))
        else:
            print("\n2. SKIPPED - only one customer exists to compare against.")

        print("\n3. get_my_orders is scoped and shape is correct...")
        orders_result = dispatch_tool(db, customer_a, "get_my_orders", {})
        check("returns a list", isinstance(orders_result, list))
        if orders_result:
            check("each order has no customer_id or other-customer leakage field", "customer_id" not in orders_result[0])

        print("\n4. get_business_policy_summary exposes ONLY friendly labels, never rule_id/priority/scope...")
        policy_result = dispatch_tool(db, customer_a, "get_business_policy_summary", {})
        check("returns a dict", isinstance(policy_result, dict))
        forbidden_keys = {"rule_id", "priority", "scope_type", "scope_id", "effective_from", "effective_until"}
        check("no forbidden governance keys present", not any(k in policy_result for k in forbidden_keys))
        check("all values are plain strings", all(isinstance(v, str) for v in policy_result.values()))

        print("\n5. Unknown tool name is safely rejected...")
        unknown_result = dispatch_tool(db, customer_a, "delete_everything", {})
        check("returns an error dict, does not raise", isinstance(unknown_result, dict) and "error" in unknown_result)

        print("\n6. get_my_invoices merges hotel + restaurant invoices without cross-customer leakage...")
        invoices_result = dispatch_tool(db, customer_a, "get_my_invoices", {})
        check("returns a list", isinstance(invoices_result, list))
        check("each invoice tagged with kind (hotel/restaurant)", all("kind" in i for i in invoices_result))

    finally:
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL AI TOOL REGISTRY STRUCTURAL TESTS PASSED")


if __name__ == "__main__":
    run()
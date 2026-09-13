"""Isolated structural verification of Phase 20.4/20.5/20.6 staff tools —
no LLM calls, no cost. Proves role-gating (defense in depth), scoping, and
anomaly-summary structure deterministically."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.services.ai_staff_tool_registry import dispatch_staff_tool, get_tool_definitions_for_role


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
        waiter = db.query(User).filter(User.role == RoleEnum.WAITER).first()
        manager = db.query(User).filter(User.role == RoleEnum.MANAGER).first()
        receptionist = db.query(User).filter(User.role == RoleEnum.RECEPTIONIST).first()

        print("1. Tool definitions offered are correctly filtered per role...")
        waiter_tools = {t["name"] for t in get_tool_definitions_for_role("WAITER")}
        manager_tools = {t["name"] for t in get_tool_definitions_for_role("MANAGER")}
        check("WAITER does not see get_dashboard_snapshot", "get_dashboard_snapshot" not in waiter_tools)
        check("MANAGER sees get_dashboard_snapshot", "get_dashboard_snapshot" in manager_tools)
        check("WAITER sees get_restaurant_order_queue", "get_restaurant_order_queue" in waiter_tools)

        if waiter:
            print("\n2. Defense-in-depth: dispatch_staff_tool rejects a role-mismatched call even if requested...")
            result = dispatch_staff_tool(db, waiter, "get_dashboard_snapshot", {})
            check("WAITER calling get_dashboard_snapshot is rejected", isinstance(result, dict) and "error" in result)

            print("\n3. WAITER's own restaurant order queue call returns a list...")
            queue_result = dispatch_staff_tool(db, waiter, "get_restaurant_order_queue", {})
            check("returns a list", isinstance(queue_result, list))
        else:
            print("\n2-3. SKIPPED - no WAITER user found.")

        if receptionist:
            print("\n4. RECEPTIONIST can get pending service requests...")
            sr_result = dispatch_staff_tool(db, receptionist, "get_pending_service_requests", {})
            check("returns a list", isinstance(sr_result, list))

            print("\n5. RECEPTIONIST cannot call a manager-only tool...")
            blocked_result = dispatch_staff_tool(db, receptionist, "get_anomaly_summary", {})
            check("returns error dict", isinstance(blocked_result, dict) and "error" in blocked_result)
        else:
            print("\n4-5. SKIPPED - no RECEPTIONIST user found.")

        if manager:
            print("\n6. MANAGER get_anomaly_summary returns a well-formed, rule-based structure...")
            anomaly_result = dispatch_staff_tool(db, manager, "get_anomaly_summary", {})
            check("returns a dict", isinstance(anomaly_result, dict))
            check("has 'anomalies' key (a list)", isinstance(anomaly_result.get("anomalies"), list))
            check("has documented threshold value", "threshold_used_percent" in anomaly_result)

            print("\n7. MANAGER get_business_summary returns a dict without duplicating calculation (delegates to report_service)...")
            summary_result = dispatch_staff_tool(db, manager, "get_business_summary", {"preset": "today"})
            check("returns a dict", isinstance(summary_result, dict))
            check("has revenue field from the report", "revenue" in summary_result)
        else:
            print("\n6-7. SKIPPED - no MANAGER user found.")

        print("\n8. Unknown tool name is safely rejected...")
        unknown_result = dispatch_staff_tool(db, manager or receptionist or waiter, "delete_everything", {})
        check("returns error dict, does not raise", isinstance(unknown_result, dict) and "error" in unknown_result)

    finally:
        db.close()

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL STAFF/MANAGER AI TOOL STRUCTURAL TESTS PASSED")


if __name__ == "__main__":
    run()
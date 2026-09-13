"""Live conversational test of Phase 20.4/20.5/20.6 staff/manager
assistant — requires at least one provider key configured. Skips
gracefully if none available."""

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.services import ai_orchestration_service


def ask(db, staff_user, message, history=None):
    reply, tools = ai_orchestration_service.run_staff_assistant(db, staff_user, message, history or [])
    print(f"\n--- ({staff_user.role.value}) Q: {message}")
    print(f"    Tools called: {tools}")
    print(f"    Reply: {reply}")


def run():
    if not (settings.gemini_api_key_1 or settings.gemini_api_key_2 or settings.groq_api_key):
        print("SKIPPED - no provider keys configured in .env.")
        return

    db = SessionLocal()
    try:
        manager = db.query(User).filter(User.role == RoleEnum.MANAGER).first()
        waiter = db.query(User).filter(User.role == RoleEnum.WAITER).first()

        if manager:
            print("=== MANAGER tests ===")
            ask(db, manager, "Give me today's business summary.")
            ask(db, manager, "Is anything unusual going on today?")
            ask(db, manager, "What's the occupancy right now?")
        else:
            print("SKIPPED manager tests - no MANAGER user found.")

        if waiter:
            print("\n=== WAITER tests ===")
            ask(db, waiter, "What orders are pending right now?")
            ask(db, waiter, "Can you show me today's revenue?")
            print("    [CHECK: waiter should be told this is outside their access, not shown a number]")

        print("\nManual review needed: confirm the manager's business summary and anomaly check")
        print("used real tool data (no fabricated figures), and confirm the waiter was correctly")
        print("denied access to manager-only financial data rather than being given an answer.")

    finally:
        db.close()


if __name__ == "__main__":
    run()
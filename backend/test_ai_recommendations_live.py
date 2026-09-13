"""Live conversational test of Phase 20.3 recommendations — requires at
least one provider key configured. Skips gracefully if none available.
Covers the two locked scenarios: dates-required for rooms, restaurant-
clarification-required for menu when history spans multiple restaurants."""

from datetime import date, timedelta

from app.models import user  # noqa
from app.models import hotel  # noqa
from app.models import restaurant  # noqa

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.services import ai_orchestration_service


def ask(db, customer, message, history=None):
    reply, tools = ai_orchestration_service.run_customer_assistant(db, customer, message, history or [])
    print(f"\n--- Q: {message}")
    print(f"    Tools called: {tools}")
    print(f"    Reply: {reply}")
    return reply, tools


def run():
    if not (settings.gemini_api_key_1 or settings.gemini_api_key_2 or settings.groq_api_key):
        print("SKIPPED - no provider keys configured in .env.")
        return

    db = SessionLocal()
    try:
        customer = db.query(User).filter(User.role == RoleEnum.CUSTOMER).first()
        if not customer:
            print("ABORT - no customer found.")
            return

        print("Test A - room recommendation WITHOUT dates (should ask for dates, not guess):")
        _, tools_a = ask(db, customer, "Can you recommend a room for me?")
        print(f"    [CHECK: get_room_recommendations should NOT be in tools_called -> {'get_room_recommendations' not in tools_a}]")

        future_check_in = (date.today() + timedelta(days=45)).isoformat()
        future_check_out = (date.today() + timedelta(days=47)).isoformat()
        print(f"\nTest B - room recommendation WITH real dates ({future_check_in} to {future_check_out}):")
        ask(db, customer, f"I want a room from {future_check_in} to {future_check_out}, any recommendations?")

        print("\nTest C - menu recommendation without specifying restaurant (should ask which one, if multiple exist in history):")
        ask(db, customer, "What should I order for dinner?")

        print("\nManual review needed: confirm Test A asked for dates rather than fabricating a recommendation,")
        print("confirm Test B's recommended rooms are real (spot-check against the database if unsure),")
        print("confirm Test C either asked which restaurant OR correctly used a single restaurant already")
        print("established in this conversation — never silently guessed among multiple options.")

    finally:
        db.close()


if __name__ == "__main__":
    run()
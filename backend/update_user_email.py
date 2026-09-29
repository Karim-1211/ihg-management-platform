"""Changes a user's login email. Notification emails go to the account
address, not the name typed at checkout, so a demo address like
karim1@test.com bounces even when the invoice shows a real one.

Run from backend/:
    python update_user_email.py karim1@test.com your.real@gmail.com

With no arguments, lists every user so you can see what's stored.
"""
import sys

from app.core.database import SessionLocal
from app.models.hotel import Hotel  # noqa: F401  (FK resolution)
from app.models.user import User


def list_users(db):
    users = db.query(User).order_by(User.role, User.email).all()
    print(f"\n{len(users)} user(s):\n")
    for u in users:
        looks_fake = any(u.email.endswith(d) for d in ("@test.com", "@example.com", "@ihg.com"))
        flag = "  <-- not a deliverable address" if looks_fake else ""
        print(f"  {u.role.value:<14} {u.email:<32} {u.first_name} {u.last_name}{flag}")
    print()


def main():
    db = SessionLocal()
    try:
        if len(sys.argv) < 3:
            list_users(db)
            print("To change one:  python update_user_email.py <old-email> <new-email>\n")
            return

        old_email, new_email = sys.argv[1].strip(), sys.argv[2].strip()

        if "@" not in new_email or "." not in new_email.split("@")[-1]:
            print(f"'{new_email}' doesn't look like a valid address.")
            return

        user = db.query(User).filter(User.email == old_email).first()
        if not user:
            print(f"No user found with email '{old_email}'.")
            list_users(db)
            return

        clash = db.query(User).filter(User.email == new_email, User.id != user.id).first()
        if clash:
            print(f"Another user ({clash.first_name} {clash.last_name}) already uses '{new_email}'.")
            return

        user.email = new_email
        db.commit()
        print(f"\n  Updated: {user.first_name} {user.last_name} ({user.role.value})")
        print(f"    {old_email}  ->  {new_email}")
        print("\n  Note: this is also the login email, so sign in with the new address.\n")
    finally:
        db.close()


if __name__ == "__main__":
    main()
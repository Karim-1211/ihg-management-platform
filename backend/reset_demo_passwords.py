"""Replaces the demonstration passwords with strong random ones.

Why: the seed and setup scripts in this repository print the demo logins
(for example admin@ihg.com / AdminPass123). Those accounts also exist on the
live site, so once the repository is public anyone could sign in as an
administrator. Run this against the LIVE database BEFORE making the repo public.

Safe by default: without --apply it only lists what it would change.
New passwords are printed once, to this console only. Copy them into a
password manager; they are not stored anywhere else.

Usage (from backend/, venv active):
    python reset_demo_passwords.py                       # list only
    python reset_demo_passwords.py --apply               # change the passwords
    python reset_demo_passwords.py --apply --also someone@example.com
"""
import secrets
import sys

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.hotel import Hotel  # noqa: F401  (foreign-key resolution)
from app.models.restaurant import Restaurant  # noqa: F401  (foreign-key resolution)
from app.models.user import User

# Accounts created by the seed and setup scripts.
DEMO_SUFFIX = "@ihg.com"
KNOWN_EXTRA = {"karim@test.com"}

# No look-alike characters (0/O, 1/l/I), so a password is easy to copy by eye.
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_password(length: int = 14) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def database_host() -> str:
    """Host only, never the password."""
    return settings.database_url.split("@")[-1].split("/")[0]


def main() -> None:
    args = sys.argv[1:]
    apply = "--apply" in args
    also = set()
    if "--also" in args:
        also = {a.lower() for a in args[args.index("--also") + 1:] if not a.startswith("--")}

    print(f"\n  Database: {database_host()}")
    print(f"  Mode:     {'APPLY (passwords will change)' if apply else 'LIST ONLY (nothing will change)'}\n")

    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.email).all()
        wanted = KNOWN_EXTRA | also
        targets = [u for u in users if u.email.lower().endswith(DEMO_SUFFIX) or u.email.lower() in wanted]
        others = [u for u in users if u not in targets]

        print(f"  {len(targets)} demo account(s) to reset:")
        for u in targets:
            print(f"    - {u.email:<32} {u.role.value}")
        print(f"\n  {len(others)} other account(s) will NOT be touched:")
        for u in others:
            print(f"    - {u.email:<32} {u.role.value}")

        if not apply:
            print("\n  Nothing changed. Check the lists above, then re-run with --apply.\n")
            return

        results = []
        for u in targets:
            password = new_password()
            u.password_hash = hash_password(password)
            results.append((u.email, u.role.value, password))
        db.commit()

        print("\n  New passwords (shown ONCE: copy them into a password manager now):\n")
        for email, role, password in results:
            print(f"    {email:<32} {role:<14} {password}")
        print("\n  Done. The old demo passwords no longer work on this database.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
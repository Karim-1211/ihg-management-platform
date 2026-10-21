"""Resets the passwords of the demonstration accounts.

Why: the seed and setup scripts in this repository contain the old demo
logins, and the same accounts exist on the live site.

Safe by default: without --apply it only lists what it would change.

Usage (from backend/, venv active):
    python reset_demo_passwords.py                                   # list only
    python reset_demo_passwords.py --password YourDemoPassword            # list the plan
    python reset_demo_passwords.py --password YourDemoPassword --apply    # easy password for all
                                                                     # except SUPER_ADMIN aounts,
                                                                     # which get strong random ones
    python reset_demo_passwords.py --apply                           # random password for everyone

Options:
    --password VALUE     the easy password to give the demo accounts
    --include-admins     also give the SUPER_ADMIN accounts the easy password
    --also a@b.com ...   extra accounts to reset (besides every @ihg.com account
                         and karim@test.com)
"""
import secrets
import sys

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.hotel import Hotel  # noqa: F401  (foreign-key resolution)
from app.models.restaurant import Restaurant  # noqa: F401  (foreign-key resolution)
from app.models.user import User

DEMO_SUFFIX = "@ihg.com"
KNOWN_EXTRA = {"karim@test.com"}
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_password(length: int = 14) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def database_host() -> str:
    """Host only, never the password."""
    return settings.database_url.split("@")[-1].split("/")[0]


def parse(args):
    o = {"apply": False, "password": None, "include_admins": False, "also": set()}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--apply":
            o["apply"] = True
        elif a == "--include-admins":
            o["include_admins"] = True
        elif a == "--password":
            i += 1
            if i >= len(args) or args[i].startswith("--"):
                raise SystemExit("--password needs a value, for example: --password YourDemoPassword")
            o["password"] = args[i]
        elif a == "--also":
            while i + 1 < len(args) and not args[i + 1].startswith("--"):
                i += 1
                o["also"].add(args[i].lower())
        else:
            raise SystemExit(f"Unknown option: {a}")
        i += 1
    return o


def main() -> None:
    opts = parse(sys.argv[1:])
    easy = opts["password"]
    if easy and len(easy) < 8:
        raise SystemExit("Please choose a password of at least 8 characters.")

    print(f"\n  Database: {database_host()}")
    print(f"  Mode:     {'APPLY (passwords will change)' if opts['apply'] else 'LIST ONLY (nothing will change)'}\n")

    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.email).all()
        wanted = KNOWN_EXTRA | opts["also"]
        targets = [u for u in users if u.email.lower().endswith(DEMO_SUFFIX) or u.email.lower() in wanted]
        others = [u for u in users if u not in targets]

        plan = []
        for u in targets:
            is_admin = u.role.value == "SUPER_ADMIN"
            use_easy = bool(easy) and (opts["include_admins"] or not is_admin)
            plan.append((u, use_easy))

        print(f"  {len(targets)} demo account(s) to reset:")
        for u, use_easy in plan:
            how = "your chosen password" if use_easy else "new random password"
            print(f"    - {u.email:<32} {u.role.value:<14} -> {how}")
        print(f"\n  {len(others)} other account(s) will NOT be touched:")
        for u in others:
            print(f"    - {u.email:<32} {u.role.value}")

        if not opts["apply"]:
            print("\n  Nothing changed. Check the lists above, then re-run with --apply.\n")
            return

        random_results = []
        for u, use_easy in plan:
            if use_easy:
                u.password_hash = hash_password(easy)
            else:
                pw = new_password()
                u.password_hash = hash_password(pw)
                random_results.append((u.email, u.role.value, pw))
        db.commit()

        easy_count = sum(1 for _, e in plan if e)
        print(f"\n  {easy_count} account(s) now use the password you chose.")
        if random_results:
            print("\n  These got NEW RANDOM passwords (shown ONCE: copy them into a password manager now):\n")
            for email, role, pw in random_results:
                print(f"    {email:<32} {role:<14} {pw}")
        print("\n  Done. The old demo passwords no longer work on this database.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""Phase 25 — targeted security tests for the fixes made in this pass:
CSV upload size/row limits. The api.js 401-handling fix is frontend-only
and is verified manually in-browser (see Phase 25 completion notes), not
via this backend test file."""

import io

from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, RoleEnum
from app.core.security import create_access_token

client = TestClient(app)


def _admin_token():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.SUPER_ADMIN).first()
        if not admin:
            return None
        return create_access_token(subject=str(admin.id), role=admin.role.value)
    finally:
        db.close()


def run():
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

    token = _admin_token()
    if not token:
        print("   ABORT - no SUPER_ADMIN user found.")
        return

    headers = {"Authorization": f"Bearer {token}"}

    print("1. Oversized CSV upload is rejected with 413, not silently processed...")
    oversized_content = b"guest_email,guest_first_name\n" + (b"a" * (6 * 1024 * 1024))
    response = client.post(
        "/api/v1/admin/bookings-import/preview",
        files={"file": ("big.csv", io.BytesIO(oversized_content), "text/csv")},
        headers=headers,
    )
    check("oversized file returns 413", response.status_code == 413)

    print("\n2. Excessive row count is rejected, not silently truncated or processed...")
    header = "guest_email,guest_first_name,guest_last_name,hotel_name,room_number,check_in_date,check_out_date,total_amount\n"
    row = "test@example.com,A,B,X,1,2024-01-01,2024-01-02,10.00\n"
    too_many_rows = header + (row * 5001)
    response = client.post(
        "/api/v1/admin/bookings-import/preview",
        files={"file": ("many_rows.csv", io.BytesIO(too_many_rows.encode()), "text/csv")},
        headers=headers,
    )
    check("excessive row count returns 422", response.status_code == 422)

    print("\n3. A normal, small, valid-shaped CSV is still accepted (limits don't over-block legitimate use)...")
    small_content = header + row
    response = client.post(
        "/api/v1/admin/bookings-import/preview",
        files={"file": ("small.csv", io.BytesIO(small_content.encode()), "text/csv")},
        headers=headers,
    )
    check("small valid file is accepted (200)", response.status_code == 200)

    print("\n4. Non-SUPER_ADMIN cannot access the import endpoint at all...")
    db = SessionLocal()
    try:
        non_admin = db.query(User).filter(User.role != RoleEnum.SUPER_ADMIN).first()
    finally:
        db.close()
    if non_admin:
        non_admin_token = create_access_token(subject=str(non_admin.id), role=non_admin.role.value)
        response = client.post(
            "/api/v1/admin/bookings-import/preview",
            files={"file": ("small.csv", io.BytesIO(small_content.encode()), "text/csv")},
            headers={"Authorization": f"Bearer {non_admin_token}"},
        )
        check("non-admin correctly blocked (403)", response.status_code == 403)
    else:
        print("   SKIPPED - no non-admin user found.")

    print()
    print(f"RESULTS: {passed} passed, {failed} failed")
    if failed > 0:
        raise SystemExit(1)
    print("ALL SECURITY HARDENING TESTS PASSED")


if __name__ == "__main__":
    run()
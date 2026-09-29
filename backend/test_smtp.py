"""Sends one test email using exactly the settings in .env, printing every
step. Isolates mail problems from the rest of the platform: if this works,
the app will too; if it fails, the error here is the real cause.

Run from backend/:
    python test_smtp.py
"""
import smtplib
import ssl
import socket
import sys

from app.core.config import settings
from app.services import email_service


def main():
    print("=" * 60)
    print("SMTP CONFIGURATION")
    print("=" * 60)
    print(f"  EMAIL_MODE   : {settings.email_mode}")
    print(f"  SMTP_HOST    : {settings.smtp_host}")
    print(f"  SMTP_PORT    : {settings.smtp_port}")
    print(f"  SMTP_USE_TLS : {settings.smtp_use_tls}")
    print(f"  SMTP_USERNAME: {settings.smtp_username}")
    password = settings.smtp_password or ""
    print(f"  SMTP_PASSWORD: {len(password)} characters"
          f"{'  <-- PROBLEM: contains spaces' if ' ' in password else ''}")
    print(f"  FROM ADDRESS : {settings.mail_from_address}")
    print()

    if settings.email_mode.upper() != "SMTP":
        print(f"  EMAIL_MODE is {settings.email_mode}, not SMTP — nothing would be sent.")
        return
    if not settings.smtp_configured:
        print("  SMTP_USERNAME or SMTP_PASSWORD is missing. Stopping.")
        return
    if len(password) != 16:
        print(f"  WARNING: a Google App Password is exactly 16 characters; this one is {len(password)}.")
        print()

    # 1. Can we even reach the server?
    print("=" * 60)
    print(f"STEP 1 — reaching {settings.smtp_host}:{settings.smtp_port}")
    print("=" * 60)
    try:
        with socket.create_connection((settings.smtp_host, settings.smtp_port), timeout=15):
            print("  OK — the port is open and reachable.\n")
    except Exception as exc:
        print(f"  FAILED: {exc}")
        print("\n  Your network is blocking this port (common on university and office")
        print("  networks). Try a mobile hotspot, or set EMAIL_MODE=DEMO and enable")
        print("  SMTP after deploying — cloud hosts don't block mail ports.")
        return

    # 2. Does Google accept the credentials?
    print("=" * 60)
    print("STEP 2 — logging in")
    print("=" * 60)
    context = ssl.create_default_context()
    try:
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=20)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
            server.ehlo()
            if settings.smtp_use_tls:
                server.starttls(context=context)
                server.ehlo()
        with server:
            server.login(settings.smtp_username, settings.smtp_password)
            print("  OK — Google accepted the credentials.\n")
    except smtplib.SMTPAuthenticationError as exc:
        print(f"  FAILED: {exc}")
        print("\n  The password was rejected. It must be a 16-character App Password")
        print("  with no spaces (myaccount.google.com/apppasswords), not your normal")
        print("  Gmail password. 2-Step Verification must be on.")
        return
    except Exception as exc:
        print(f"  FAILED: {type(exc).__name__}: {exc}")
        if settings.smtp_port == 465:
            print("\n  If this says the connection closed, the SMTP_SSL patch in")
            print("  email_service.py may not be applied. Or try port 587 with")
            print("  SMTP_USE_TLS=true.")
        return

    # 3. Send through the real application path.
    print("=" * 60)
    print("STEP 3 — sending a test message")
    print("=" * 60)
    to = sys.argv[1] if len(sys.argv) > 1 else settings.smtp_username
    print(f"  To: {to}")
    success, error = email_service.send_email(
        to,
        "IHG Platform — test email",
        "If you're reading this, email delivery is working correctly.\n\nIHG Grand Dhaka",
    )
    if success:
        print("  SENT. Check the inbox — and the spam folder.\n")
        print("  Everything works. The platform will now deliver automatically.")
    else:
        print(f"  FAILED: {error}")


if __name__ == "__main__":
    main()
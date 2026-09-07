from app.core.config import settings


def send_email(to_email: str, subject: str, body: str) -> tuple[bool, str | None]:
    """Returns (success, error_message). In DEMO mode, never contacts a real
    provider — always succeeds instantly. The notifications table itself
    (filtered to channel=EMAIL) serves as the dev email log."""
    if settings.email_mode == "DEMO":
        return True, None

    # Real provider integration (SMTP/SES/SendGrid/etc.) would go here in a
    # future phase. Not implemented — DEMO is the only supported mode today.
    return False, "Email provider not configured (only DEMO mode is supported)."
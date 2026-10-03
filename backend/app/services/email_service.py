"""Email delivery. Two modes, chosen by EMAIL_MODE:

  DEMO  — never contacts a provider; every send "succeeds" instantly and
          the notifications table (channel=EMAIL) is the log.
  SMTP  — really sends. The transport is chosen automatically:
            * Brevo's HTTPS API when BREVO_API_KEY is set (production —
              hosts like Render's free tier block outbound SMTP ports);
            * otherwise SMTP over SSL (port 465) or STARTTLS (port 587).

Failures are returned, never raised: a delivery problem must never break
the business transaction that triggered the notification.
"""
import base64
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import requests

from app.core.config import settings

logger = logging.getLogger("ihg.email")

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


def _fallback_html(subject: str, body: str) -> str:
    safe = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
    return f"""<html><body style="margin:0;padding:28px 14px;background:#F0EBE3;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1F3A5F;padding:22px 32px;">
    <span style="color:#fff;font-size:23px;font-weight:800;">IHG</span>
    <span style="color:#FF2147;font-size:10px;font-weight:700;letter-spacing:2.6px;margin-left:14px;">HOSPITALITY</span>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 16px;color:#1F3A5F;font-size:21px;">{subject}</h1>
    <p style="margin:0;color:#475569;font-size:14.5px;line-height:24px;">{safe}</p>
  </td></tr>
</table></td></tr></table></body></html>"""


def _send_via_brevo(
    to_email: str,
    subject: str,
    body: str,
    html: str,
    attachments: list[tuple[bytes, str, str]] | None,
) -> tuple[bool, str | None]:
    """Brevo's transactional API over HTTPS. Same contract as the SMTP path:
    returns (success, error_message) and never raises."""
    payload = {
        "sender": {"name": settings.smtp_from_name, "email": settings.mail_from_address},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": body,
    }
    if attachments:
        payload["attachment"] = [
            {"content": base64.b64encode(content).decode("ascii"), "name": filename}
            for content, filename, _subtype in attachments
        ]

    try:
        response = requests.post(
            BREVO_ENDPOINT,
            json=payload,
            headers={
                "api-key": settings.brevo_api_key,
                "accept": "application/json",
                "content-type": "application/json",
            },
            timeout=settings.smtp_timeout_seconds,
        )
    except requests.RequestException as exc:
        return False, f"Could not reach Brevo: {exc}"

    if response.status_code in (200, 201, 202):
        return True, None

    detail = response.text[:300]
    try:
        detail = response.json().get("message", detail)
    except ValueError:
        pass

    if response.status_code == 401:
        return False, f"Brevo rejected the request (check BREVO_API_KEY and Brevo's authorised IPs): {detail}"
    return False, f"Brevo error {response.status_code}: {detail}"


def _send_via_smtp(message: EmailMessage) -> tuple[bool, str | None]:
    try:
        context = ssl.create_default_context()

        # Port 465 speaks SSL from the first byte; 587 connects in the clear
        # and upgrades with STARTTLS. Networks that throttle 587 often leave
        # 465 alone, so both are supported.
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=settings.smtp_timeout_seconds) as server:
                server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as server:
                server.ehlo()
                if settings.smtp_use_tls:
                    server.starttls(context=context)
                    server.ehlo()
                server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        return True, None
    except smtplib.SMTPAuthenticationError:
        return False, "SMTP login rejected. For Gmail, use a 16-character App Password, not your account password."
    except smtplib.SMTPRecipientsRefused:
        return False, f"The mail server refused the recipient address: {message['To']}"
    except smtplib.SMTPException as exc:
        return False, f"SMTP error: {exc}"
    except (TimeoutError, OSError) as exc:
        return False, f"Could not reach the mail server: {exc}"


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    attachments: list[tuple[bytes, str, str]] | None = None,
) -> tuple[bool, str | None]:
    """Returns (success, error_message). `attachments` is a list of
    (content_bytes, filename, mime_subtype) — e.g. (pdf, "invoice.pdf", "pdf").
    In DEMO mode nothing leaves the machine and the send always succeeds."""
    if settings.email_mode.upper() == "DEMO":
        return True, None

    if not to_email or "@" not in to_email:
        return False, f"Invalid recipient address: {to_email!r}"

    html = html_body or _fallback_html(subject, body)

    if settings.uses_brevo:
        if not settings.mail_from_address:
            return False, "BREVO_API_KEY is set but SMTP_FROM_EMAIL is not."
        return _send_via_brevo(to_email, subject, body, html, attachments)

    if not settings.smtp_configured:
        return False, "Email is not configured (set BREVO_API_KEY, or SMTP_USERNAME and SMTP_PASSWORD)."

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, settings.mail_from_address))
    message["To"] = to_email
    message.set_content(body)
    message.add_alternative(html, subtype="html")
    for content, filename, subtype in (attachments or []):
        message.add_attachment(content, maintype="application", subtype=subtype, filename=filename)

    return _send_via_smtp(message)
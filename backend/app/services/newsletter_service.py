"""Newsletter subscription service. Subscribing is deliberately
idempotent, and the public endpoint returns the same friendly message
whether or not the address was already on the list — so the form can
never be used to probe who is subscribed."""

import csv
import io

from sqlalchemy.orm import Session

from app.models.newsletter import NewsletterSubscriber


def subscribe(
    db: Session,
    email: str,
        first_name: str | None = None,
        last_name: str | None = None,
        zip_code: str | None = None,
        source: str = "website",
) -> tuple[NewsletterSubscriber, bool]:
    normalized = email.strip().lower()
    existing = db.query(NewsletterSubscriber).filter(NewsletterSubscriber.email == normalized).first()

    if existing:
        was_already_active = existing.is_active
        if not existing.is_active:
            existing.is_active = True
            existing.unsubscribed_at = None
        if first_name and not existing.first_name:
            existing.first_name = first_name.strip()
        if last_name and not existing.last_name:
            existing.last_name = last_name.strip()
        if zip_code and not existing.zip_code:
            existing.zip_code = zip_code.strip()
        db.commit()
        db.refresh(existing)
        return existing, was_already_active

    subscriber = NewsletterSubscriber(
        email=normalized,
        first_name=first_name.strip() if first_name else None,
        last_name=last_name.strip() if last_name else None,
        zip_code=zip_code.strip() if zip_code else None,
        source=source,
        is_active=True,
    )
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    return subscriber, False


def subscribe_with_welcome_code(
    db: Session,
    email: str,
    first_name: str | None = None,
    last_name: str | None = None,
    zip_code: str | None = None,
    source: str = "website",
):
    """Subscribes and issues the welcome discount code.

    The code is issued even when the address was already on the list, so a
    returning visitor is never left empty-handed — issue_subscriber_code is
    itself idempotent and returns the existing unused code in that case.

    A failure to issue never fails the subscription: being on the list is
    the thing the guest asked for."""
    from app.services import promo_service

    subscriber, already_subscribed = subscribe(
        db, email, first_name=first_name, last_name=last_name, zip_code=zip_code, source=source
    )

    promo = None
    try:
        promo = promo_service.issue_subscriber_code(db, subscriber.email, source=source)
    except Exception:
        promo = None

    return subscriber, already_subscribed, promo


def list_subscribers(db: Session, active_only: bool = True) -> list[NewsletterSubscriber]:
    query = db.query(NewsletterSubscriber)
    if active_only:
        query = query.filter(NewsletterSubscriber.is_active == True)  # noqa: E712
    return query.order_by(NewsletterSubscriber.created_at.desc()).all()


def export_csv(db: Session, active_only: bool = True) -> str:
    subscribers = list_subscribers(db, active_only=active_only)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["first_name", "last_name", "email", "zip_code", "source", "is_active", "subscribed_at"])
    for s in subscribers:
        writer.writerow([
            s.first_name or "",
            s.last_name or "",
            s.email,
            s.zip_code or "",
            s.source,
            "yes" if s.is_active else "no",
            s.created_at.isoformat() if s.created_at else "",
        ])
    return buffer.getvalue()


def build_welcome_email(subscriber, promo=None) -> tuple[str, str, str]:
    """The welcome email. Sent directly rather than through the notification
    system, because that routes by user id and a subscriber may have no
    account — there is no user to resolve."""
    name = (subscriber.first_name or "there").strip()
    percent = int(float(promo.percent_off) * 100) if promo else None

    subject = (
        f"Welcome — here's {percent}% off your next visit"
        if percent else "Welcome to the IHG list"
    )

    code_block = ""
    text_code = ""
    if promo:
        expires = promo.expires_at.strftime("%d %B %Y") if promo.expires_at else ""
        code_block = f"""
        <div style="margin:26px 0;padding:24px;border:2px dashed rgba(255,33,71,0.35);border-radius:14px;background:rgba(255,33,71,0.04);text-align:center;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.6px;color:#94a3b8;text-transform:uppercase;">{percent}% off your next</p>
          <p style="margin:4px 0 0;font-size:13px;color:#64748b;">booking, table or delivery</p>
          <p style="margin:16px 0 0;font-family:monospace;font-size:28px;font-weight:700;letter-spacing:5px;color:#1F3A5F;">{promo.code}</p>
          <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">Enter it at checkout{f' · valid until {expires}' if expires else ''}</p>
        </div>"""
        text_code = f"\n\nYour code: {promo.code}\n{percent}% off your next booking, table or delivery.{f' Valid until {expires}.' if expires else ''}\n"

    html = f"""<html><body style="margin:0;padding:28px 14px;background:#F0EBE3;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1F3A5F;padding:22px 32px;">
    <span style="color:#fff;font-size:23px;font-weight:800;">IHG</span>
    <span style="color:#FF2147;font-size:10px;font-weight:700;letter-spacing:2.6px;margin-left:14px;">HOSPITALITY</span>
  </td></tr>
  <tr><td style="padding:34px 32px;">
    <h1 style="margin:0 0 18px;color:#1F3A5F;font-size:23px;">Welcome, {name}.</h1>
    <p style="margin:0 0 14px;color:#475569;font-size:14.5px;line-height:24px;">
      Thank you for joining us. We write occasionally — seasonal rates, new suites, and what the kitchen is doing next — and never more than we'd want to receive ourselves.
    </p>
    {code_block}
    <p style="margin:0;color:#475569;font-size:14.5px;line-height:24px;">
      Your code works across the hotel, the restaurant and delivery. We look forward to welcoming you.
    </p>
  </td></tr>
  <tr><td style="padding:20px 32px;background:#FBFAF8;border-top:1px solid #e9e5df;">
    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:18px;">
      IHG Grand Dhaka · 123 Gulshan Avenue, Dhaka, Bangladesh<br>
      One click to leave, whenever you like.
    </p>
  </td></tr>
</table></td></tr></table></body></html>"""

    text = f"Welcome, {name}.\n\nThank you for joining the IHG list.{text_code}\nIHG Grand Dhaka"
    return subject, html, text


def send_welcome_email(subscriber_email: str, subject: str, html: str, text: str) -> None:
    """Fire-and-forget: a mail problem must never fail the subscription."""
    from app.services import email_service
    try:
        email_service.send_email(subscriber_email, subject, text, html_body=html)
    except Exception:
        pass
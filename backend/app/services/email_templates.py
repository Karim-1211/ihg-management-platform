"""Per-event email content.

The in-app notification needs one short line; an email needs a greeting,
the details that matter, and a clear next step. This module builds the
second from the same metadata, falling back to the plain notification
message for event types with no tailored version.
"""
from app.models.notification import NotificationType

NAVY = "#1F3A5F"
RED = "#FF2147"
PROPERTY = "IHG Grand Dhaka"


def _esc(value) -> str:
    return (str(value or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _money(value) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value or "")


def _pretty_date(value) -> str:
    from datetime import date, datetime
    if not value:
        return ""
    try:
        d = value if isinstance(value, (date, datetime)) else datetime.fromisoformat(str(value)).date()
        return d.strftime("%d %B %Y")
    except Exception:
        return str(value)


def _rows_html(rows: list[tuple[str, str]]) -> str:
    if not rows:
        return ""
    cells = "".join(
        f'<tr>'
        f'<td style="padding:9px 0;border-bottom:1px solid #e9e5df;color:#64748b;font-size:13px;">{_esc(label)}</td>'
        f'<td style="padding:9px 0;border-bottom:1px solid #e9e5df;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">{_esc(value)}</td>'
        f'</tr>'
        for label, value in rows if value
    )
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">{cells}</table>'


def _highlight_html(label: str, text: str) -> str:
    return (
        f'<div style="margin:22px 0;padding:16px 18px;background:#F5F2ED;border-left:3px solid {RED};border-radius:0 8px 8px 0;">'
        f'<p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:1.4px;color:#94a3b8;">{_esc(label)}</p>'
        f'<p style="margin:0;font-size:14px;line-height:22px;color:#334155;font-style:italic;">{_esc(text)}</p>'
        f'</div>'
    )


def _total_html(label: str, amount) -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">'
        f'<tr>'
        f'<td style="padding-top:12px;border-top:2px solid {NAVY};color:{NAVY};font-size:15px;font-weight:700;">{_esc(label)}</td>'
        f'<td style="padding-top:12px;border-top:2px solid {NAVY};color:{NAVY};font-size:22px;font-weight:700;text-align:right;">{_esc(_money(amount))}</td>'
        f'</tr></table>'
    )


def _shell(heading: str, body_html: str, footer_note: str = "") -> str:
    return f"""<html><body style="margin:0;padding:28px 14px;background:#F0EBE3;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 18px rgba(15,23,42,0.07);">
  <tr><td style="background:{NAVY};padding:22px 32px;">
    <span style="color:#ffffff;font-size:23px;font-weight:800;letter-spacing:-0.6px;">IHG</span>
    <span style="color:{RED};font-size:10px;font-weight:700;letter-spacing:2.6px;margin-left:14px;">HOSPITALITY</span>
  </td></tr>
  <tr><td style="padding:34px 32px 30px;">
    <h1 style="margin:0 0 18px;color:{NAVY};font-size:23px;font-weight:700;line-height:30px;">{heading}</h1>
    {body_html}
  </td></tr>
  <tr><td style="padding:20px 32px;background:#FBFAF8;border-top:1px solid #e9e5df;">
    <p style="margin:0;color:#94a3b8;font-size:11px;line-height:18px;">
      {footer_note or f"{PROPERTY} · 123 Gulshan Avenue, Dhaka, Bangladesh"}<br>
      This is an automated message — no reply is needed.
    </p>
  </td></tr>
</table></td></tr></table></body></html>"""


def _p(text: str) -> str:
    return f'<p style="margin:0 0 14px;color:#475569;font-size:14.5px;line-height:24px;">{text}</p>'


def build(notification, recipient) -> tuple[str, str, str]:
    """Returns (subject, html_body, plain_text_body)."""
    meta = notification.metadata_json or {}
    first_name = _esc(getattr(recipient, "first_name", "") or "there")
    ntype = notification.notification_type

    if ntype == NotificationType.BOOKING_CONFIRMED:
        reference = _esc(meta.get("booking_reference"))
        rows = [
            ("Booking reference", meta.get("booking_reference")),
            ("Room", " — ".join(x for x in [meta.get("room_number") and f"Room {meta['room_number']}", meta.get("room_type")] if x)),
            ("Arrive", _pretty_date(meta.get("check_in_date"))),
            ("Depart", _pretty_date(meta.get("check_out_date"))),
            ("Length of stay", meta.get("nights") and f"{meta['nights']} night{'' if str(meta['nights']) == '1' else 's'}"),
            ("Guests", meta.get("number_of_guests")),
        ]
        body = _p(f"Dear {first_name},") + _p(
            f"Your reservation at <b>{PROPERTY}</b> is confirmed. We're looking forward to welcoming you."
        ) + _rows_html(rows)
        if meta.get("total_amount"):
            body += _total_html("Total", meta["total_amount"])
        if meta.get("special_requests"):
            body += _highlight_html("YOUR REQUEST TO US", meta["special_requests"]) + _p(
                "We've passed this to our front desk team and will do everything we can to accommodate it."
            )
        body += _p("Should anything change before your arrival, simply sign in to your account to view or amend the booking.")
        return f"Booking confirmed — {reference}", _shell("Your booking is confirmed", body), _plain(notification, meta)

    if ntype == NotificationType.INVOICE_CREATED:
        number = _esc(meta.get("invoice_number"))
        body = _p(f"Dear {first_name},") + _p(
            "Your invoice is ready. A PDF copy is attached to this email for your records."
        ) + _rows_html([("Invoice number", meta.get("invoice_number"))])
        if meta.get("total_amount"):
            body += _total_html("Amount", meta["total_amount"])
        body += _p("You can also view this invoice at any time under <b>My Activity</b> in your account.")
        return f"Invoice {number} — {PROPERTY}", _shell("Your invoice", body), _plain(notification, meta)

    if ntype == NotificationType.PAYMENT_COMPLETED:
        rows = [("Invoice number", meta.get("invoice_number")), ("Amount paid", _money(meta.get("amount")))]
        body = _p(f"Dear {first_name},") + _p(
            "Thank you — your payment has been received in full. This email is your receipt."
        ) + _rows_html(rows) + _p(
            "This is a demonstration platform, so no real funds were transferred."
        )
        return f"Payment received — {PROPERTY}", _shell("Payment received", body), _plain(notification, meta)

    if ntype == NotificationType.BOOKING_CANCELLED:
        body = _p(f"Dear {first_name},") + _p(
            f"Your booking <b>{_esc(meta.get('booking_reference'))}</b> has been cancelled, as requested."
        ) + _p("We hope to welcome you another time. You're welcome to book again whenever suits you.")
        return f"Booking cancelled — {_esc(meta.get('booking_reference'))}", _shell("Your booking is cancelled", body), _plain(notification, meta)

    if ntype == NotificationType.CHECK_IN_COMPLETED:
        body = _p(f"Dear {first_name},") + _p(
            f"You're checked in to <b>room {_esc(meta.get('room_number'))}</b>. Enjoy your stay."
        ) + _p("Need anything at all? Request housekeeping, amenities or room service straight from your account — or ask Alice, our concierge, any time.")
        return f"Checked in — room {_esc(meta.get('room_number'))}", _shell("Welcome to IHG Grand Dhaka", body), _plain(notification, meta)

    if ntype == NotificationType.CHECK_OUT_COMPLETED:
        body = _p(f"Dear {first_name},") + _p(
            f"You've checked out of room {_esc(meta.get('room_number'))}. Thank you for staying with us."
        ) + _p("Your final invoice is available under My Activity. We'd be delighted to welcome you back.")
        return "Thank you for staying with us", _shell("Until next time", body), _plain(notification, meta)

    if ntype in (NotificationType.DELIVERY_OUT_FOR_DELIVERY, NotificationType.DELIVERY_DELIVERED, NotificationType.ORDER_READY, NotificationType.ORDER_SERVED):
        body = _p(f"Dear {first_name},") + _p(_esc(notification.message)) + _p(
            "You can follow every step of your order under <b>Delivery → My Orders</b>."
        )
        return f"{notification.title} — {PROPERTY}", _shell(notification.title, body), _plain(notification, meta)

    # Everything else: the standard shell around the notification's own line.
    body = _p(f"Dear {first_name},") + _p(_esc(notification.message))
    return f"{notification.title} — {PROPERTY}", _shell(notification.title, body), _plain(notification, meta)


def _plain(notification, meta) -> str:
    lines = [notification.message, ""]
    if meta.get("special_requests"):
        lines += [f"Your request to us: {meta['special_requests']}", ""]
    lines.append(f"{PROPERTY} — this is an automated message.")
    return "\n".join(lines)
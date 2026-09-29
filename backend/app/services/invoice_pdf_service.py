"""Renders an invoice as a branded PDF, in memory, for email attachment.

Handles both invoice kinds: HOTEL (a booking, its room and stay) and
RESTAURANT (an order and its lines). Never raises — if a PDF can't be
produced the email is still sent, just without the attachment, because a
formatting problem must never stop a receipt reaching the guest.
"""
import io
import logging
import os
import uuid

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.models.billing import Invoice, InvoiceType, Payment
from app.models.hotel import Booking, Hotel, Room, RoomType
from app.models.restaurant import MenuItem, Order, OrderItem, Restaurant
from app.models.user import User

logger = logging.getLogger("ihg.invoice_pdf")

NAVY = colors.HexColor("#1F3A5F")
RED = colors.HexColor("#FF2147")
GREY = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")

_LOGO_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "frontend", "public", "brand", "logo-mark.png")
)


def _money(value) -> str:
    return f"${float(value or 0):,.2f}"


def _pretty_date(value) -> str:
    try:
        return value.strftime("%d %B %Y")
    except Exception:
        return str(value or "")


def _styles():
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=20, textColor=NAVY, spaceAfter=2),
        "sub": ParagraphStyle("sub", parent=base["Normal"], fontName="Helvetica", fontSize=9, textColor=GREY),
        "label": ParagraphStyle("label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7.5, textColor=GREY, spaceAfter=3),
        "body": ParagraphStyle("body", parent=base["Normal"], fontName="Helvetica", fontSize=9.5, textColor=colors.HexColor("#1E293B"), leading=14),
        "right": ParagraphStyle("right", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=12, textColor=NAVY, alignment=TA_RIGHT),
        "note": ParagraphStyle("note", parent=base["Normal"], fontName="Helvetica-Oblique", fontSize=9, textColor=GREY, leading=13),
    }


def _header(invoice: Invoice, property_name: str, property_lines: list[str], s) -> Table:
    left = []
    if os.path.exists(_LOGO_PATH):
        try:
            left.append(Image(_LOGO_PATH, width=13 * mm, height=13 * mm))
            left.append(Spacer(1, 4))
        except Exception:
            pass
    left.append(Paragraph(f"<b>{property_name}</b>", s["h1"]))
    for line in property_lines:
        if line:
            left.append(Paragraph(line, s["sub"]))

    right = [
        Paragraph("INVOICE", s["label"]),
        Paragraph(f"<b>{invoice.invoice_number}</b>", s["right"]),
        Spacer(1, 4),
        Paragraph(f"Issued {_pretty_date(invoice.issued_at)}", s["sub"]),
        Paragraph(f"Status: <b>{invoice.status.value}</b>", s["sub"]),
    ]

    table = Table([[left, right]], colWidths=[105 * mm, 60 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def _two_columns(left_label, left_lines, right_label, right_lines, s) -> Table:
    left = [Paragraph(left_label, s["label"])] + [Paragraph(x, s["body"]) for x in left_lines if x]
    right = [Paragraph(right_label, s["label"])] + [Paragraph(x, s["body"]) for x in right_lines if x]
    table = Table([[left, right]], colWidths=[85 * mm, 80 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def _lines_table(rows: list[tuple[str, str]], totals: list[tuple[str, str, bool]]) -> Table:
    data = [["Description", "Amount"]]
    data += [[desc, amount] for desc, amount in rows]
    for label, amount, _ in totals:
        data.append([label, amount])

    table = Table(data, colWidths=[125 * mm, 40 * mm])
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), GREY),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#1E293B")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]
    for i in range(1, len(rows) + 1):
        style.append(("LINEBELOW", (0, i), (-1, i), 0.4, LINE))

    first_total = len(rows) + 1
    for offset, (_, _, is_grand) in enumerate(totals):
        row = first_total + offset
        if is_grand:
            style += [
                ("FONTNAME", (0, row), (-1, row), "Helvetica-Bold"),
                ("FONTSIZE", (0, row), (-1, row), 12),
                ("TEXTCOLOR", (0, row), (-1, row), NAVY),
                ("LINEABOVE", (0, row), (-1, row), 0.8, NAVY),
                ("TOPPADDING", (0, row), (-1, row), 9),
            ]
        else:
            style.append(("TEXTCOLOR", (0, row), (-1, row), GREY))
    table.setStyle(TableStyle(style))
    return table


def _highlight(title: str, text: str, s) -> Table:
    inner = [Paragraph(title, s["label"]), Paragraph(text, s["note"])]
    table = Table([[inner]], colWidths=[165 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F2ED")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, RED),
    ]))
    return table


def _payment_block(db: Session, invoice: Invoice, s) -> list:
    payments = db.query(Payment).filter(Payment.invoice_id == invoice.id).order_by(Payment.created_at).all()
    if not payments:
        return []
    lines = []
    for p in payments:
        method = p.method.value.title() if p.method else "Demo"
        lines.append(f"{_money(p.amount)} · {method} · {p.payment_number}")
    return [Spacer(1, 14), Paragraph("PAYMENT RECEIVED", s["label"])] + [Paragraph(x, s["body"]) for x in lines]


def _build_hotel(db: Session, invoice: Invoice, story: list, s) -> str:
    booking = db.query(Booking).filter(Booking.id == invoice.booking_id).first()
    room = db.query(Room).filter(Room.id == booking.room_id).first() if booking else None
    room_type = db.query(RoomType).filter(RoomType.id == room.room_type_id).first() if room else None
    hotel = db.query(Hotel).filter(Hotel.id == room.hotel_id).first() if room else None
    customer = db.query(User).filter(User.id == invoice.customer_id).first() if invoice.customer_id else None

    property_name = getattr(hotel, "name", None) or "IHG Grand Dhaka"
    address = ", ".join(x for x in [getattr(hotel, "address", None), getattr(hotel, "city", None), getattr(hotel, "country", None)] if x)
    story.append(_header(invoice, property_name, [address, getattr(hotel, "phone", "") or ""], s))
    story.append(Spacer(1, 18))

    guest_name = (booking.guest_name if booking and booking.guest_name else None) \
        or (f"{customer.first_name} {customer.last_name}" if customer else "Guest")
    guest_email = (booking.guest_email if booking and booking.guest_email else None) \
        or (customer.email if customer else "")
    guest_phone = booking.guest_phone if booking and booking.guest_phone else ""

    nights = (booking.check_out_date - booking.check_in_date).days if booking else 0
    stay_lines = []
    if room:
        stay_lines.append(f"Room {room.room_number}" + (f" — {room_type.name}" if room_type else ""))
    if booking:
        stay_lines += [
            f"{_pretty_date(booking.check_in_date)} → {_pretty_date(booking.check_out_date)}",
            f"{nights} night{'' if nights == 1 else 's'} · {booking.number_of_guests} guest{'' if booking.number_of_guests == 1 else 's'}",
            f"Booking reference: {booking.booking_reference}",
        ]

    story.append(_two_columns("BILLED TO", [guest_name, guest_email, guest_phone], "STAY", stay_lines, s))
    story.append(Spacer(1, 20))

    rate = float(room_type.base_price) if room_type else 0
    rows = [(f"Room charge ({nights} night{'' if nights == 1 else 's'} × {_money(rate)})", _money(invoice.room_charge or invoice.subtotal))]
    if float(invoice.service_charge or 0) > 0:
        rows.append(("Service charge", _money(invoice.service_charge)))

    totals = []
    if float(invoice.tax_amount or 0) > 0:
        totals.append(("Tax", _money(invoice.tax_amount), False))
    if float(invoice.discount_amount or 0) > 0:
        totals.append(("Discount", f"-{_money(invoice.discount_amount)}", False))
    totals.append(("Total", _money(invoice.total_amount), True))

    story.append(_lines_table(rows, totals))

    if booking and booking.special_requests:
        story.append(Spacer(1, 18))
        story.append(_highlight("YOUR REQUEST TO US", booking.special_requests, s))

    story += _payment_block(db, invoice, s)
    return f"invoice-{invoice.invoice_number}.pdf"


def _build_restaurant(db: Session, invoice: Invoice, story: list, s) -> str:
    order = db.query(Order).filter(Order.id == invoice.order_id).first()
    restaurant = db.query(Restaurant).filter(Restaurant.id == invoice.restaurant_id).first()
    customer = db.query(User).filter(User.id == invoice.customer_id).first() if invoice.customer_id else None

    property_name = getattr(restaurant, "name", None) or "IHG Grand Dhaka Restaurant"
    story.append(_header(invoice, property_name, [getattr(restaurant, "address", "") or "", getattr(restaurant, "phone", "") or ""], s))
    story.append(Spacer(1, 18))

    guest_name = f"{customer.first_name} {customer.last_name}" if customer else "Guest"
    guest_email = customer.email if customer else ""

    order_lines = []
    if order:
        order_lines.append(f"Order {order.order_number}")
        order_lines.append(order.order_type.value.replace("_", " ").title())
        if order.delivery_address:
            order_lines.append(order.delivery_address)

    story.append(_two_columns("BILLED TO", [guest_name, guest_email], "ORDER", order_lines, s))
    story.append(Spacer(1, 20))

    rows = []
    if order:
        for item in db.query(OrderItem).filter(OrderItem.order_id == order.id).all():
            menu_item = db.query(MenuItem).filter(MenuItem.id == item.menu_item_id).first()
            name = menu_item.name if menu_item else "Item"
            rows.append((f"{item.quantity} × {name}", _money(item.subtotal)))
    if not rows:
        rows = [("Order total", _money(invoice.subtotal))]

    totals = []
    if float(invoice.service_charge or 0) > 0:
        totals.append(("Service charge", _money(invoice.service_charge), False))
    if float(invoice.tax_amount or 0) > 0:
        totals.append(("Tax", _money(invoice.tax_amount), False))
    if float(invoice.discount_amount or 0) > 0:
        totals.append(("Discount", f"-{_money(invoice.discount_amount)}", False))
    totals.append(("Total", _money(invoice.total_amount), True))

    story.append(_lines_table(rows, totals))
    story += _payment_block(db, invoice, s)
    return f"invoice-{invoice.invoice_number}.pdf"


def build_invoice_pdf(db: Session, invoice_id: uuid.UUID) -> tuple[bytes, str] | None:
    """Returns (pdf_bytes, filename), or None if it can't be produced."""
    try:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            return None

        s = _styles()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            leftMargin=22 * mm, rightMargin=22 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
            title=f"Invoice {invoice.invoice_number}", author="IHG Hospitality",
        )
        story: list = []

        if invoice.invoice_type == InvoiceType.HOTEL:
            filename = _build_hotel(db, invoice, story, s)
        else:
            filename = _build_restaurant(db, invoice, story, s)

        story.append(Spacer(1, 26))
        story.append(Paragraph(
            "This is a demonstration invoice generated by the IHG Hospitality platform. "
            "No real payment was processed.", s["sub"]
        ))

        doc.build(story)
        return buffer.getvalue(), filename
    except Exception:
        logger.exception("Could not build PDF for invoice %s", invoice_id)
        return None
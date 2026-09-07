from app.models.notification import NotificationType

# Email preference default when no notification_preferences row exists for
# a (user, notification_type) pair. Opt-out model: new users receive emails
# by default until they explicitly disable a type.
DEFAULT_EMAIL_ENABLED = True

# These notification types always send email regardless of user preference.
# Kept intentionally small — financial/critical events only.
MANDATORY_EMAIL_TYPES = {
    NotificationType.INVOICE_CREATED,
    NotificationType.PAYMENT_COMPLETED,
    NotificationType.PAYMENT_FAILED,
}

# Maximum attempts before a PENDING email notification is marked FAILED permanently.
MAX_EMAIL_ATTEMPTS = 3

# Title/message templates per notification type. {placeholders} filled from
# NotificationEvent.metadata at dispatch time.
NOTIFICATION_TEMPLATES: dict[NotificationType, dict[str, str]] = {
    NotificationType.BOOKING_CONFIRMED: {
        "title": "Booking Confirmed",
        "message": "Your booking {booking_reference} is confirmed for {check_in_date} to {check_out_date}.",
    },
    NotificationType.BOOKING_CANCELLED: {
        "title": "Booking Cancelled",
        "message": "Your booking {booking_reference} has been cancelled.",
    },
    NotificationType.CHECK_IN_COMPLETED: {
        "title": "Checked In",
        "message": "You have been checked in to room {room_number}. Enjoy your stay!",
    },
    NotificationType.CHECK_OUT_COMPLETED: {
        "title": "Checked Out",
        "message": "You have been checked out of room {room_number}. Thank you for staying with us.",
    },
    NotificationType.SERVICE_REQUEST_CREATED: {
        "title": "New Service Request",
        "message": "A new {request_type} request was made for room {room_number}.",
    },
    NotificationType.SERVICE_REQUEST_COMPLETED: {
        "title": "Service Request Completed",
        "message": "Your {request_type} request has been completed.",
    },
    NotificationType.ORDER_CREATED: {
        "title": "New Order",
        "message": "New order {order_number} received.",
    },
    NotificationType.ORDER_READY: {
        "title": "Order Ready",
        "message": "Order {order_number} is ready.",
    },
    NotificationType.ORDER_SERVED: {
        "title": "Order Served",
        "message": "Your order {order_number} has been served. Enjoy your meal!",
    },
    NotificationType.DELIVERY_ASSIGNED: {
        "title": "Delivery Assigned",
        "message": "You have been assigned to deliver order {order_number}.",
    },
    NotificationType.DELIVERY_OUT_FOR_DELIVERY: {
        "title": "Out For Delivery",
        "message": "Your order {order_number} is out for delivery.",
    },
    NotificationType.DELIVERY_DELIVERED: {
        "title": "Delivered",
        "message": "Your order {order_number} has been delivered. Enjoy!",
    },
    NotificationType.INVOICE_CREATED: {
        "title": "Invoice Generated",
        "message": "Invoice {invoice_number} for ${total_amount} has been generated.",
    },
    NotificationType.PAYMENT_COMPLETED: {
        "title": "Payment Successful",
        "message": "Your payment of ${amount} for invoice {invoice_number} was successful.",
    },
    NotificationType.PAYMENT_FAILED: {
        "title": "Payment Failed",
        "message": "Your payment for invoice {invoice_number} could not be processed.",
    },
    NotificationType.LOW_STOCK_ALERT: {
        "title": "Low Stock Alert",
        "message": "'{item_name}' is running low: {current_quantity} {unit} remaining (minimum {minimum_quantity}).",
    },
}


def render_template(notification_type: NotificationType, metadata: dict) -> tuple[str, str]:
    template = NOTIFICATION_TEMPLATES[notification_type]
    title = template["title"]
    try:
        message = template["message"].format(**metadata)
    except KeyError:
        # If metadata is missing an expected key, fall back to the raw
        # template rather than raising — a notification should never crash
        # the calling business transaction over a formatting gap.
        message = template["message"]
    return title, message
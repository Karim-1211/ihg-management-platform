"""
Report calculation policies and known limitations.

DESIGN NOTE — Historical Occupancy (deliberately excluded from Phase 17.1):

The current schema (Room.status) stores only the room's CURRENT physical
state (READY/CLEANING/MAINTENANCE/OUT_OF_SERVICE). There is no historical
room-status ledger anywhere in the system, so "how many rooms were sellable
on a given past date" cannot be reconstructed reliably.

DO NOT calculate historical occupancy percentage by dividing occupied
room-nights by TODAY'S sellable room count. That silently misrepresents
the past — a room that is OUT_OF_SERVICE today may have been sellable
during the reporting period, or vice versa.

If historical occupancy trending becomes a real requirement:
  1. Either introduce a proper room-status history/ledger table, OR
  2. Report a numerator-only metric ("occupied room-nights during the
     period") without a misleading percentage denominator.

Either way, the occupied-room-night interval logic must be:
    check_in_date <= day < check_out_date
(the checkout day itself is NOT an occupied night).

This note exists so a future developer does not "fix" the missing KPI by
reintroducing the exact flawed calculation this design deliberately avoided.
"""

# Business-local day boundary policy (same as Phase 16.1's dashboard_constants.py):
# "today"/date ranges are computed as UTC calendar days. No application-level
# business timezone exists in this project. If one is introduced later, only
# the date-boundary helper functions need to change.

MAX_CUSTOM_RANGE_DAYS = 366  # arbitrary but bounded upper limit for a custom report range, to keep queries reasonable

SUPPORTED_PRESETS = {"today", "yesterday", "last_7_days", "last_30_days", "this_month", "previous_month", "custom"}

# Category A rule keys — already migrated, resolver-driven since Phase 18.5.
CATEGORY_A_RULE_KEYS = {
    "BILLING_TAX_RATE",
    "OPERATIONS_SERVICE_REQUEST_ESCALATION_MINUTES",
    "OPERATIONS_KITCHEN_BOTTLENECK_MINUTES",
    "RESTAURANT_DEFAULT_RESERVATION_MINUTES",
}

# =========================================================
# Phase 18.7A — Category B, booking restrictions
# =========================================================
#
# DESIGN NOTE — Check-in moment used for cancellation-deadline math:
# Booking.check_in_date is date-only (no time-of-day). Per the locked
# Phase 18.7 decision, the check-in "moment" for deadline calculations is
# treated as check_in_date at 00:00 UTC — the exact same business-local
# calendar-day boundary convention already established in Phase 16.1's
# dashboard_constants.py and reused throughout Phase 17. No new time
# concept is introduced and the Booking model is NOT altered.
#
# These four rules did not exist as hard-coded behavior before Phase 18.7;
# they are net-new restrictions, not migrations of prior behavior. Seeding
# them with permissive defaults is a deliberate business-policy choice
# (see seed_business_rules_category_b.py), not a neutral migration.

CATEGORY_B_BOOKING_RULE_KEYS = {
    "HOTEL_CANCELLATION_DEADLINE_HOURS",
    "HOTEL_MINIMUM_STAY_NIGHTS",
    "HOTEL_MAXIMUM_STAY_NIGHTS",
    "HOTEL_MAXIMUM_ADVANCE_BOOKING_DAYS",
}
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
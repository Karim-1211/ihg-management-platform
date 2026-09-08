# Demo/assumed operational policies — not specified in the original proposal.
# Phase 18 (Configurable Business Rules) should make these admin-configurable.

SERVICE_REQUEST_ESCALATION_MINUTES = 30  # a PENDING service request older than this counts as "overdue"

FAILED_PAYMENT_LOOKBACK_HOURS = 24  # only failed payments within this window count as "needs attention"

KITCHEN_PREPARATION_ESCALATION_MINUTES = 20  # a PREPARING order older than this counts as a kitchen bottleneck

# "Today" is computed as the UTC calendar day. No application-level business
# timezone exists anywhere in this project as of Phase 16.1; if one is
# introduced later, only this module's date-boundary helper needs to change.
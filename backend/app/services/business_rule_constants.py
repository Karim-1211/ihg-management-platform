"""Business Rules Engine — policy notes and reserved values.

DESIGN NOTE — Ambiguity handling (locked decision):
When two ACTIVE rules share the same rule_key + same effective scope +
same priority + overlapping effective windows, the resolver treats this
as an unresolvable ambiguity and raises rather than silently picking one
via a tie-breaker (e.g. "most recent effective_from wins"). This is a
deliberate governance choice: an ambiguous configuration is a data-entry
error that should be surfaced and fixed, not silently resolved.

Precedence order (most specific wins):
    RESTAURANT scope > HOTEL scope > GLOBAL scope
Within the same scope: higher `priority` wins.
If priority also ties: AMBIGUOUS — raise, do not guess.

Effective window: effective_from <= now < effective_until
(effective_until IS NULL means open-ended / no expiry).
"""

# Category A rule keys — the only rules this engine currently governs.
# Category B (cancellation deadlines, stay limits, pricing modifiers,
# discounts, service charges) is explicitly deferred; do not add keys
# here for policies that have no real enforcement logic yet.
CATEGORY_A_RULE_KEYS = {
    "BILLING_TAX_RATE",
    "OPERATIONS_SERVICE_REQUEST_ESCALATION_MINUTES",
    "OPERATIONS_KITCHEN_BOTTLENECK_MINUTES",
    "RESTAURANT_DEFAULT_RESERVATION_MINUTES",
}
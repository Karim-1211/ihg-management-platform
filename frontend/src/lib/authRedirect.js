// Browsing is open to everyone; only committing needs an account. This
// sends the guest to sign in and brings them straight back to the exact
// page they were on — the booking, the reservation, the checkout — so
// nothing they set up is lost along the way.
export function requireAuth(user, navigate, location, options = {}) {
  if (user) return true
  const from = options.from || `${location.pathname}${location.search}`
  navigate('/login', { state: { from, reason: options.reason || null } })
  return false
}
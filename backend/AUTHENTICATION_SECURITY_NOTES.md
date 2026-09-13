# Authentication Security Notes

**Status: documented tradeoff, not an open issue requiring immediate action. This is preserved intentionally per the locked Phase 25 boundary — no authentication rewrite was performed.**

## JWT Storage: localStorage

The frontend stores the JWT access token in `localStorage` (`ihg_token`), attached to every outgoing request via an axios request interceptor (`frontend/src/services/api.js`).

**The tradeoff:** `localStorage` is readable by any JavaScript executing in the page's origin. If this application were ever compromised by a cross-site scripting (XSS) vulnerability, an attacker's injected script could read and exfiltrate the token. An `httpOnly` cookie would not have this specific weakness, since JavaScript cannot read an `httpOnly` cookie's value at all.

**Why this was not changed in Phase 25:**
1. No XSS vulnerability has been identified anywhere in this codebase — the risk is a standing architectural characteristic, not evidence of an active exploit path.
2. Switching to cookie-based storage is a materially larger change than a targeted security fix: it requires the backend to set/read cookies instead of a bearer header, CSRF protection to be added (cookies are automatically sent by the browser, which introduces a different attack class — CSRF — that bearer-token-in-header architectures don't have), and every API call pattern across the entire frontend to be re-verified.
3. This project's own Phase 25 scope explicitly excludes an authentication rewrite unless a critical, concretely-identified flaw is found — a standing architectural tradeoff with no active exploit is not that.

**Mitigations already in place that reduce this risk:**
- Access tokens expire after 30 minutes (`access_token_expire_minutes` in `config.py`), limiting the window a stolen token remains valid.
- The application has no `dangerouslySetInnerHTML`, no `eval`, and no user-supplied content rendered as raw HTML anywhere in this codebase (React's default JSX rendering escapes content automatically) — reducing the realistic XSS attack surface that would be needed to exploit this tradeoff in the first place.
- A response interceptor (added in Phase 25) now clears the token and redirects to login on any `401`, limiting how long a genuinely invalidated/expired token lingers in browser storage.

**If this is ever revisited:** migrating to `httpOnly` cookies with CSRF-token protection would be the standard hardening path, but should be treated as its own dedicated phase with its own test plan — not bundled into a general security audit.
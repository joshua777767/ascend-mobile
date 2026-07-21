---
name: Refresh token architecture
description: How the persistent-login refresh-token system works; what touches it and why.
---

## The rule
Session cookie (connect.sid) is 30-day rolling. When it expires the client automatically calls POST /api/auth/refresh using the long-lived ascend.rt cookie (1 year, non-rolling). This restores a session invisibly — the user never sees a login screen.

## Cookie settings (both cookies)
- httpOnly: true, secure: true, sameSite: "none", path: "/"
- SameSite=None is mandatory for WKWebView (see ios-webview-cookie.md)
- ascend.rt maxAge: 365 days; connect.sid maxAge: 30 days rolling

## DB table
`refresh_tokens`: userId, tokenHash (SHA-256 of raw token), expiresAt, revokedAt, createdAt.
Raw token is NEVER stored — only the hash. Cookie value is the raw 32-byte hex token.

## Token rotation
Every successful call to POST /auth/refresh:
1. Looks up token by SHA-256(raw).
2. Sets revokedAt on the old row.
3. Generates a new raw token, inserts a new row, sets new ascend.rt cookie.
Replay attacks are blocked because the old hash is immediately invalidated.

## client-side interceptor (lib/api-client-react/src/custom-fetch.ts)
- On 401, checks URL: skips /auth/refresh, /auth/login, /auth/logout to prevent loops.
- Calls tryRefreshSession() — a singleton Promise that deduplicates concurrent 401 storms.
- On success: retries original fetch exactly once.
- On failure: re-throws ApiError so useAuth sees 401 and renders the login screen.

## cookie-parser requirement
cookie-parser middleware must be added to app.ts BEFORE session middleware so req.cookies is populated when auth routes read ascend.rt. Both cookie-parser and @types/cookie-parser were already in package.json.

**Why:** express-session only parses its own cookie; req.cookies is undefined without cookie-parser.

## Logout
Revokes the DB row (revokedAt = NOW()) and clears the ascend.rt cookie BEFORE destroying the session. Even if session destroy fails the long-lived token is already gone.

## Simulation verification
Verified via Python script against live HTTPS dev domain:
- Both cookies issued on signup ✅
- 401 on expired session → /auth/refresh → 204 → retry /me → 200 ✅
- Two idle cycles, both restored correctly ✅
- /auth/refresh returns 401 after logout ✅
- All DB tokens revoked after logout ✅

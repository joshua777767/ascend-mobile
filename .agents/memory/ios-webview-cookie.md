---
name: iOS WKWebView session cookie
description: SameSite=Lax cookies are silently dropped by iOS WKWebView because the native app's origin differs from the website's; must use SameSite=None + secure:true.
---

## Rule
Session cookies must be set with `sameSite: "none"` and `secure: true` for the iOS native WebView to persist and send them across app relaunches.

**Why:** iOS WKWebView treats the native app shell as a different origin than `ascendfit.fitness`. `SameSite=Lax` only allows cookies on "top-level same-site navigation." Because the initiating context is the native app (not the website), iOS classifies all navigation as cross-site and silently drops Lax cookies. The user appears to be logged out on every relaunch even though the session is valid in the Postgres store.

`SameSite=None` lifts the site restriction so the cookie is sent in all contexts. It requires `Secure: true`. The Replit proxy always terminates TLS, and `trust proxy: 1` is set in `app.ts` so Express sees HTTPS from the `X-Forwarded-Proto` header — meaning `secure: true` works correctly in all environments (dev and prod).

**How to apply:** In `artifacts/api-server/src/app.ts`, the express-session cookie block:
```js
cookie: {
  httpOnly: true,
  secure: true,           // always — Replit proxy always uses HTTPS
  sameSite: "none",       // required for WKWebView cross-origin context
  maxAge: 1000 * 60 * 60 * 24 * 30,
}
```
Do NOT revert to `sameSite: "lax"` or make `secure` conditional on `NODE_ENV`.

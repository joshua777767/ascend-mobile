---
name: Owner admin access & forgot-password silent failures
description: Why admin "Access denied" and forgot-password "not sending" can both stem from a missing DB user row.
---

Admin access is gated by a hardcoded `OWNER_EMAIL` (`joshquag2010@icloud.com`) compared case-insensitively against `user.email`, both client (`admin.tsx`) and server (`admin.ts` `requireOwner`). If no `users` row has that email, the owner can never reach `/admin` — even though the route and protection are correct.

Forgot-password (`auth.ts /auth/forgot-password`) looks up the email; if no user is found it returns the SAFE message (`"If an account exists with that email, a reset link has been sent."`) **without sending anything**. This is an intentional account-enumeration defense, but it masks the real problem: the account simply doesn't exist.

**Why:** Both features can appear "broken" when the true cause is just a missing user row.
**How to apply:** When the owner reports admin lockout or "reset emails not arriving", first check the DB for a row matching OWNER_EMAIL before touching code/env. Seed the account with the app's scrypt format (`lib/password.ts`: `salt(16 bytes hex):scrypt(pw,salt,64).hex`).

Email infra (confirmed working): `RESEND_API_KEY` is a send-only key (can't query /domains, returns 401 restricted_api_key, but POST /emails works). From-domain `ascendfit.fitness` is verified in Resend. `APP_BASE_URL` (shared env) controls the reset link base; falls back to `https://ascendfit.fitness` if unset.

---
name: Password reset token behavior
description: TTL source-of-truth rule and how to diagnose "reset link expired early" reports.
---

**Rule:** The reset-token lifetime (1 hour) is a single source of truth shared by the handler and the email copy — never hardcode the duration separately in the email, or the message and real expiry drift.

**Rule:** Reset validation must return distinct errors for not-found vs already-used/superseded vs expired. A single generic "invalid or expired" message hides the real cause and produces false "expired early" bug reports.

**Rule:** A new forgot-password request invalidates all prior unused tokens for that user; token consumption is an atomic conditional UPDATE (flip used_at only if still NULL) for single-use under concurrency.

**Why:** A user reported links "expiring after ~14 min" despite 1-hour copy. The DB proved every token lived the full hour and none were consumed — the bug was purely the ambiguous error message. Likely real trigger: a superseded link or clicking a link against a different deployment's DB (reset link uses APP_BASE_URL = https://ascendfit.fitness).
**How to apply:** When a reset link "fails early," trust the distinct error text first and inspect `password_reset_tokens` (lifespan = expires_at - created_at, plus used_at) before suspecting the TTL. A link validated against a different env's database returns "invalid," not "expired."

---
name: Production vs development environment separation
description: Prod has its own database and runs the last-published build, not current dev code.
---

**Production is a separate environment from development:** it has its own Postgres database (different rows — real users, not dev test data) AND it runs the last *published* build, not whatever is currently in the dev workspace.

**Why:** An "owner can't access admin page" bug turned out to have correct dev code — admin (`/admin`) is gated purely by an email match against a hardcoded `OWNER_EMAIL` (in both `admin.ts` backend and `admin.tsx` frontend; no role column). The owner email had been changed in code from an old address to the new one, but the app was never re-published, so production still authorized the OLD owner and returned 403 for the new one. Dev worked; prod didn't.

**How to apply:** When something works in dev but fails for the user, suspect a stale deployment first. Check the production database (database skill, `environment: "production"`) and the production deployment logs separately. Any code change that affects prod behavior (constants like owner email, gating logic, schema) only takes effect after the user re-publishes. The agent cannot deploy — use `suggest_deploy` and tell the user to publish.

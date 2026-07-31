---
name: Railway runtime variables
description: Required production configuration for running the API outside Replit.
---

Railway must have production variables before starting the API. The server fails before listening when `DATABASE_URL`, `SESSION_SECRET`, or `OPENAI_API_KEY` is absent; password reset and subscription webhooks also need their respective optional variables.

**Why:** A Railway deployment can show successful build and deploy phases, then produce no HTTP health logs when the process exits during module initialization because the service has no variables.

**How to apply:** Provision Railway Postgres and set `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `APP_BASE_URL`, `RESEND_API_KEY`, and `REVENUECAT_WEBHOOK_SECRET` as applicable. Let Railway inject `PORT`; do not copy Replit's database URL blindly.
---
name: Stripe removal
description: What was changed when Stripe was stripped from the project and what to restore if re-adding it.
---

Stripe was fully removed from the API server. Files deleted: stripeClient.ts, stripeService.ts, stripeStorage.ts, webhookHandlers.ts. Files kept as stubs: routes/stripePublic.ts (returns "not available" JSON), routes/stripe.ts (checkout/portal/subscription return 503). routes/index.ts unchanged.

auth.ts: `checkStripeSubscription` replaced from an async live-API call to a synchronous DB-only check (`subscriptionStatus === "active" || "trialing"`). The `await` was removed at both call sites (login + /auth/me). The usersTable still has stripeCustomerId/subscriptionStatus columns — no schema change.

app.ts: Stripe webhook middleware removed (was required before express.json()). index.ts: runMigrations + getStripeSync + initStripe() removed.

**Why:** iOS IAP (RevenueCat) is the monetization path, so Stripe is not needed.

**How to re-add:** Restore the four deleted files, restore initStripe() in index.ts, restore the webhook in app.ts, and restore the live checkStripeSubscription in auth.ts.

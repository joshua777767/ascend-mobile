---
name: OTA bundle picks up Replit EXPO_PUBLIC_ secrets
description: Why entitlement IDs and other EXPO_PUBLIC_ values must be hardcoded, not read from env vars, in OTA-updated code.
---

# OTA bundle picks up Replit EXPO_PUBLIC_ secrets

## The rule
Never read `EXPO_PUBLIC_*` values from `process.env` in code that is deployed via `eas update` (OTA). Hardcode the values directly instead.

**Why:** `eas update` builds the JS bundle locally in the Replit environment. ALL `EXPO_PUBLIC_*` Replit secrets are baked into that bundle. The Replit secret `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` is set to `"pro"`, but the real RC entitlement key is `"Ascend: AI Fitness Pro"`. Every OTA pushed with the env-var pattern checked the wrong key → `isPro` was always `false` → paywall always showed — even though RC was returning the correct Pro subscription.

The EAS binary build (eas build) runs in EAS cloud and only uses env vars from `eas.json`, so the binary was unaffected. This created the confusing "first launch works, second launch doesn't" pattern: launch 1 = binary JS (correct ID), launch 2 = OTA JS (wrong ID).

**How to apply:**
- `ENTITLEMENT_ID` in `SubscriptionContext.tsx` is hardcoded to `"Ascend: AI Fitness Pro"` — do not revert to env var.
- For any other RC or payment constant that comes from a Replit secret, hardcode the correct value in the source file or add it to `eas.json` (for binary builds) rather than relying on `process.env`.
- Before pushing an OTA, check `printenv | grep EXPO_PUBLIC` in the Replit shell. Any value there that differs from what the binary expects will silently break the OTA.

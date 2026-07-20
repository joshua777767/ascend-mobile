---
name: EAS build env vars must be explicit
description: EXPO_PUBLIC_ env vars set as Replit secrets are NOT forwarded to EAS cloud builds — they must be listed in eas.json env block or the feature silently breaks at runtime.
---

There are TWO separate bundle contexts that need `EXPO_PUBLIC_*` vars, and they are sourced differently:

**1. EAS cloud binary builds (`eas build`)**
- Run on Expo's cloud servers — Replit secrets are NOT available.
- `EXPO_PUBLIC_*` vars must be explicitly listed in `eas.json` under the relevant profile's `env` block.
- Check `eas.json` production env includes at minimum: `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.

**2. EAS OTA updates (`eas update` run from Replit)**
- Bundle is built LOCALLY on Replit, then uploaded.
- `EXPO_PUBLIC_*` vars must exist as Replit environment variables (set via `setEnvVars` or the Secrets tab).
- `eas.json` env blocks are NOT read during `eas update` — only during `eas build`.
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` must be set as a Replit env var for OTA updates to work.

**Why this matters:** Every OTA update pushed without `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` in Replit's environment had an empty API key. RC hit `if (!apiKey)` → posted `SUBSCRIPTION_STATUS{isPro:false}` immediately → bailed. The SDK was never initialized. Users were stuck on the paywall despite having active subscriptions.

**Current state:** `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is set in Replit shared env (never store the value here). All future OTA updates will have it.

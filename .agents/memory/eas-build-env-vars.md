---
name: EAS build env vars must be explicit
description: EXPO_PUBLIC_ env vars set as Replit secrets are NOT forwarded to EAS cloud builds — they must be listed in eas.json env block or the feature silently breaks at runtime.
---

EAS builds run on Expo's cloud servers, not in the Replit environment. Replit secrets (including `EXPO_PUBLIC_*` vars) are NOT automatically available during EAS builds.

**Rule:** Before triggering any EAS build, audit `eas.json` and confirm every `EXPO_PUBLIC_` var the app reads at runtime is listed in the relevant build profile's `env` block with its literal value.

**Why:** `EXPO_PUBLIC_` vars are baked into the JS bundle at build time. If missing, the app gets an empty string silently — no build error, no warning, just a broken feature at runtime. In this project, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` was missing from the production profile, causing every IAP attempt to fail immediately with "API key not set" — this caused multiple unnecessary Apple rejections before the root cause was found.

**How to apply:** When setting up or modifying an EAS build for this project, check that `eas.json` production env includes at minimum:
- `EXPO_PUBLIC_DOMAIN`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`

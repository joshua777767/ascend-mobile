---
name: EAS Update — skip auto-fingerprint flag
description: eas update requires EAS_SKIP_AUTO_FINGERPRINT=1 in Replit to avoid a blocked git tagging step that kills the publish.
---

# EAS Update in Replit

## Rule
Always pass `EAS_SKIP_AUTO_FINGERPRINT=1` when running `eas update` from Replit.

**Why:** `eas update` tries to write a git tag / commit fingerprint metadata at the end of the publish step. Replit's main-agent sandbox blocks all destructive git operations, so without the flag the command exits with error code 254 after uploading the bundle — the publish never finalises.

**How to apply:**
```bash
EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 pnpm exec eas update \
  --channel production --platform ios \
  --message "..." --non-interactive
```

Also add `--platform ios` to cut Metro bundle time roughly in half for an iOS-only app.

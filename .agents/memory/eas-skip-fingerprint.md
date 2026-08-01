---
name: EAS Update — skip auto-fingerprint flag
description: eas update may need fingerprint flags in a restricted workspace to avoid a blocked git tagging step.
---

# EAS Update in a restricted workspace

## Rule
Pass `EAS_SKIP_AUTO_FINGERPRINT=1` when running `eas update` from a workspace where git tag writes are blocked.

**Why:** `eas update` tries to write a git tag / commit fingerprint metadata at the end of the publish step. A restricted workspace can block that operation, causing the command to exit after uploading the bundle — the publish never finalises.

**How to apply:**
```bash
EXPO_TOKEN=$EXPO_TOKEN EAS_SKIP_AUTO_FINGERPRINT=1 pnpm exec eas update \
  --channel production --platform ios \
  --message "..." --non-interactive
```

Also add `--platform ios` to cut Metro bundle time roughly in half for an iOS-only app.

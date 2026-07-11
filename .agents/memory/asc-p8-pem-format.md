---
name: ASC p8 key PEM format for eas submit
description: The ASC_API_KEY_P8_CONTENT secret is stored as raw base64 without PEM headers; must be reformatted before writing to disk for eas submit.
---

# ASC p8 key PEM format

The `ASC_API_KEY_P8_CONTENT` Replit secret contains only the raw base64 body of the EC private key — no `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` headers, and with spaces instead of newlines. `echo "$VAR" > /tmp/asc_key.p8` produces a malformed one-liner that Apple rejects silently ("Something went wrong").

**How to apply:** Always reformat via Python before running `eas submit`:

```python
import os, textwrap
raw = os.environ.get('ASC_API_KEY_P8_CONTENT', '')
b64 = raw.replace(' ', '').replace('\n', '').replace('\r', '')
wrapped = '\n'.join(textwrap.wrap(b64, 64))
pem = '-----BEGIN PRIVATE KEY-----\n' + wrapped + '\n-----END PRIVATE KEY-----\n'
with open('/tmp/asc_key.p8', 'w') as f:
    f.write(pem)
```

**Why:** Apple's App Store Connect API validates PEM structure strictly. A one-line file with no headers causes a generic "Something went wrong" error from Expo's submit service with no further detail from the CLI.

**Note:** EAS submit in Replit also times out at 120s while waiting for the Apple upload to complete. Use `--no-wait` to schedule it and check the Expo submissions dashboard for the actual result: https://expo.dev/accounts/ascend-ai-coach/projects/ascend-mobile/submissions

---
name: Mobile-web feature parity status
description: Which web features are now in the mobile app vs still missing
---

## Done (as of build 19)
- Home: all 13 sections, web-exact colors (#6B8BAE, #4A9B78, #C89A3E)
- Meals: photo analyzer, AI feedback, meal generator, score badge, Good/Watch/Next structured sections
- Schedule: status toggle, custom tasks, Next Up indicator, progress bar, ±15 min time adjust
- Workouts: exercise list, completion toggle, coach tips, AsyncStorage persistence
- Coach: full chat, suggested chips, emergency param auto-send (useLocalSearchParams `message`)
- Journal: habit toggles, ratings, AI review, Perfect Day badge (≥80)
- Progress: weight chart, score chart, weekly review, Goal Pace Predictor, milestones

## Web-only (not on mobile, acceptable)
- Schedule drag-and-drop reorder (complex gesture lib, mobile has ±15 instead)
- Meals: "Water Also Detected" banner (minor edge case)
- Font: web=Space Mono, mobile=Inter (user hasn't asked to match)

## EAS Build history
- Build 19: a538dcb7-5987-42d8-ba8a-aba8827c7c38 (in progress, July 2026)

## Key submission fix
ASC_API_KEY_P8_CONTENT is stored as raw base64 on one line (no PEM headers, spaces instead of newlines).
Must reformat it before submitting:
```python
raw = os.environ.get('ASC_API_KEY_P8_CONTENT', '')
content = raw.replace(' ', '').strip()
pem = "-----BEGIN PRIVATE KEY-----\n" + textwrap.fill(content, 64) + "\n-----END PRIVATE KEY-----\n"
```
First submit attempt (89e69907) failed because key was written as-is with `printenv > file` (missing PEM headers).

## Successful submission
- Build 19: a538dcb7-5987-42d8-ba8a-aba8827c7c38 → FINISHED
- Submission: 324edd1c-fd6a-4952-adbe-5f5a6761c466 → FINISHED (TestFlight, July 10 2026)

---
name: Project Upgrade AI fallbacks
description: OpenAI quota state in dev and how meal/coach features degrade
---

The project's OPENAI_API_KEY hits 429 insufficient_quota in the dev environment, so
every AI-backed feature (meal feedback, coach chat, daily reviews, weigh-in adjustments)
always falls through to its graceful fallback. The full AI code path is correct but
untestable until quota is restored — test and verify the fallback path instead.

**Meal feedback fallback:** deterministic `heuristicFeedback()` in
`artifacts/api-server/src/routes/meals.ts` scores the typed description against the
user's goal using GOOD_FOODS / BAD_FOODS keyword lists (base 60, +9 per good, -14 per
bad, clamped 5-100). Goal-aware (fat_loss / muscle_gain specialized, others generic).
Image-only with no text returns a neutral "add a description" message.

**Meal images:** stored as base64 data URLs in `meals.imageUrl` (no object storage);
client compresses to ~1024px JPEG; `express.json` limit is 12mb. Server validates the
data URL prefix is `data:image/(png|jpe?g|webp|gif);base64,`.

**Why:** avoids a hard dependency on AI availability for a core logging flow, and keeps
the feature demoable without quota.

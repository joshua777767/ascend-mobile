---
name: Project Upgrade AI fallbacks
description: OpenAI quota state in dev and the design rules for the deterministic fallbacks
---

The project's OpenAI key hits 429 insufficient_quota in dev, so every AI-backed feature
(meal feedback, coach chat, daily reviews, weigh-in adjustments) always degrades to a
deterministic fallback. The AI code paths are correct but untestable until quota returns
— verify the FALLBACK behavior, not the live AI.

**Why fallbacks exist:** core flows (logging a meal, asking the coach) must work and demo
without any AI dependency. Each AI call is wrapped so 429/empty responses route to a local
heuristic instead of a generic "offline" stub.

**Coach chat safety ordering (do not reorder):** the chat fallback is an ordered keyword
matcher and ordering is the safety contract — crisis/self-harm and medical/injury
redirects MUST be checked before any coaching topic, so a message mixing crisis wording
with a fitness question never falls through to generic advice. When editing, keep these
two checks first and keep their keyword coverage broad (include common variants).

**Required tone/safety for any coach copy (AI or fallback):** strict but encouraging,
direct not mean, positive not corny. Never give medical advice, never recommend
starvation/extreme fasting, never promise guaranteed results.

**Units:** always present weight to the user in lbs (kg ×2.2046226), never kg.

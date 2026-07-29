---
name: Coach chat dual-path design
description: The AI coach has two answer paths (LLM system prompt + deterministic heuristic) that must stay in sync; heuristic uses ordered keyword branches that can hijack intent.
---

# Coach chat has two answer paths that must stay in sync

The coach chat handler answers via an OpenAI call driven by a large system prompt, with a deterministic `heuristicReply` used as a graceful fallback when OpenAI fails/quota-exceeds.

**Rule:** When you change the coaching philosophy (e.g. "coach behaviors, not just calorie math"), you must update BOTH the system prompt AND `heuristicReply`, or the fallback silently contradicts the AI path.

**Why:** Users hit the fallback whenever OpenAI is unavailable; if only the prompt is updated, behavior diverges invisibly depending on API health.

**How to apply:**
- `heuristicReply` is a chain of ordered `if (has(m, [...]))` keyword branches — first match wins. Broad triggers placed early hijack more specific intents placed later. Example bug: a bare `"why"` trigger in the calorie branch caught "why am I not losing weight?" before the fat-loss branch. Keep broad keywords gated (require a co-occurring domain word) and order specific intents appropriately.
- The fallback has no LLM, so it can only use static plan targets + profile fields, not nuanced adherence reasoning the prompt asks for. Accept that asymmetry; don't try to fully replicate AI judgment in the heuristic.
- Nutrition authority is server-side: chat context marks plan calories/protein as verified engine output, includes normal activity, today's scheduled/completed workout, steps, timeframe, and a multi-weigh-in trend. If activity is unclear, the fallback asks for weekly training frequency and steps instead of inferring high activity from one gym day.
- **Why:** The coach must interpret deterministic nutrition outputs rather than become a second calorie calculator; a single workout must not promote an otherwise inactive profile or create double-counted exercise calories.
- **How to apply:** Keep the AI system prompt and heuristic aligned whenever nutrition behavior changes. Load enough weigh-ins for a two-week trend, use the user's timezone for "today," and never let chat override `plansTable` calorie/protein targets.
- Verify the real AI path with a curl e2e (signup → POST /api/chat); a throwaway user with no plan will show `[placeholder]` slots because there's no calorie/protein target in context — that's expected, real onboarded users have a plan.

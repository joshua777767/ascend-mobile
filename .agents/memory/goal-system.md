---
name: Goal system & plan generation
description: How Ascend turns user-selected goals into daily actions, and the double-parse pitfall that silently emptied goals.
---

# Goals → daily actions pipeline

- User goals are stored on `userProfiles.goals` as a JSON **string** (text column). The exact goal strings offered in onboarding are: `lose fat`, `lose weight`, `gain weight`, `build muscle`, `maintain fitness`, `better skin`, `higher energy`, `better sleep`, `discipline`. "Athletic performance" is NOT a goal — it is a `workoutFocus` value (`athletic_performance`) plus an optional `sport`.
- `planGenerator.generatePlan` builds the combined daily mission: per-goal habit lists are deduped into `keyHabits` (capped at 12) and `coachNotes` leads with "You picked {goals}. Today's mission: ...". The dashboard renders `plan.keyHabits` as the interactive "Today's Checklist".

## The double-parse trap (caused goals to be silently empty)

**Rule:** `generatePlan` may receive `profile.goals` as EITHER a JSON string OR an already-parsed array, so its `parseGoals` must handle both.

**Why:** `routes/plans.ts` parses `goals`/`skinConcerns`/`digestionConcerns` into arrays *before* calling `generatePlan`. The old `parseGoals` did `JSON.parse(goalsJson)` unconditionally; `JSON.parse(anArray)` stringifies the array (`"a,b,c"`) then throws → caught → returned `[]`. Net effect: every plan was generated with ZERO goals, so goal-specific habits/coachNotes never fired. This is the real reason "goals didn't give enough direction."

**How to apply:** Any function consuming a JSON-text DB column that is also pre-parsed at some call sites must accept `unknown` and branch on `Array.isArray` vs `typeof === "string"`. Don't assume the raw string shape.

## Other notes

- Caffeine cutoff is derived as `sleepTime − 8h`, formatted 12-hour. Bedtime = `profile.sleepTime`.
- Never promise to cure acne; for "better skin" the plan appends a dermatologist referral line.

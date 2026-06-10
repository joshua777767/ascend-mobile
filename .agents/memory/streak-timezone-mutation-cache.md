---
name: Streak timezone + mutation cache pitfalls
description: Two bugs found in streak logic — timezone date math and React Query mutation cache update
---

## Bug 1: addDaysInUserTz used midnight UTC as anchor

`new Date(\`${date}T00:00:00\`)` on a UTC server = midnight UTC.
For UTC-offset timezones (e.g. EDT, UTC-4), midnight UTC is 8pm the *previous* local day.
`toLocaleDateString` then formats it as yesterday's date, so "yesterday" resolves one day too early.
Consecutive-day check fails → streak resets to 1.

**Fix:** Anchor to noon UTC: `new Date(\`${date}T12:00:00.000Z\`)` + `setUTCDate`/`getUTCDate` for arithmetic.
This is the same pattern used in `getLocalMidnightUtc` elsewhere.

**How to apply:** Any function that adds/subtracts calendar days to a YYYY-MM-DD string and then
formats the result in a local timezone must use noon UTC as the anchor, not midnight.

## Bug 2: Mutation result not written into query cache

`recordStreakFn().catch(() => {})` discarded the server response.
The `useGetStreak` query cache was never updated after the POST.
UI showed stale streak count (1) even though DB was updated to 2.

**Fix:** Chain `.then(updated => queryClient.setQueryData([...getGetStreakQueryKey(), localDate], updated))`
so the mutation response is written directly into the cache, giving instant UI feedback.

**How to apply:** Any mutation that updates data shown by a GET query must either:
- `.then(data => queryClient.setQueryData(key, data))` — preferred for instant update
- `await queryClient.invalidateQueries(key)` — triggers a refetch (adds latency)
Never silently `.catch(() => {})` a mutation whose result should update the UI.

## Bug 3: Reviews submitted before streak logic deployed → lastStreakDate NULL

If a user had qualifying reviews before the streak-from-review feature was deployed,
`lastStreakDate` is NULL. The consecutive-day check (`last === yesterday`) would fail
and streak restarts at 1 instead of continuing.

**Fix:** When `lastStreakDate` is null or stale, look up yesterday's coach_review in the DB.
If that review exists and `dailyScore >= 70`, treat today as consecutive (increment).
Only fall back to `newStreak = 1` if yesterday had no qualifying review.

**How to apply:** Any new "streak from event" feature that backfills existing users should
either (a) run a DB migration to set lastStreakDate from historical records, or (b) do the
fallback DB lookup in the update logic itself. (b) is safer — no migration risk.

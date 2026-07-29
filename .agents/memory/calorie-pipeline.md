---
name: Calorie pipeline
description: Calorie targets must keep activity-level TDEE and explicit workout burns mutually exclusive.
---

The calorie pipeline uses a profile activity multiplier when available; that multiplier already includes usual workouts, so scheduled workout calories must not be added again. Legacy profiles without activity level use a sedentary base and add explicit scheduled exercise burns only on active days.

**Why:** Adding workout calories on top of a high/very-active multiplier can inflate weight-loss targets and make the same workout count twice.

**How to apply:** Preserve the breakdown fields (BMR, multiplier, base TDEE, exercise addition, maintenance, deficit, final target) whenever changing calorie logic, and verify both profile-activity and legacy fallback paths.

## Age-aware safety (under-18 vs adult)

Minors (age < 18) get a deliberately smaller deficit/surplus range and a higher calorie floor than adults — same BMR formula (Mifflin-St Jeor, all ages), but safety is applied entirely via caps/floors, not a separate pediatric formula:
- Fat-loss deficit: adults 300 (casual)/500 (other), capped 300–500 at max 1 lb/wk. Minors 250/300, capped 200–300 at max 0.6 lb/wk.
- Muscle-gain surplus: adults 250/300/400(extreme), capped 250–400 at max 0.8 lb/wk. Minors 200/300 — **no extreme-discipline path** — capped 150–300 at max 0.5 lb/wk.
- Recomp surplus: adults 75(casual)/100. Minors always flat 75 regardless of commitment.
- Calorie floor: adults 1500(M)/1200(F). Minors 1800(M)/1600(F).
- Protein for minors overrides the goal-weight-based calc entirely: current weight × 1.5 g/kg (fat_loss) or × 1.7 g/kg (muscle_gain/recomp), rounded to nearest 5 — ignores goal weight on purpose.

**Why:** A full pediatric EER regression could not be safely sourced (web fetch failed on every nutrition-science source tried in one session — globalrph, NCBI Bookshelf, Nestle, MyPlate, Wikipedia); hallucinating pediatric constants was judged an unacceptable health-safety risk. Caps/floors on top of the well-verified adult formula were chosen as the safer alternative — don't assume this is a placeholder to "finish later" without a genuine new source.

**How to apply:** Any future change to deficit/surplus/floor constants must update both the adult and minor branch deliberately — they are intentionally different, not a shared constant with an age multiplier.

## Gotchas

- `commitmentLevel: "committed"` is NOT a neutral/default value — it fails every `=== "casual"` and `=== "extreme_discipline"` check, so it always lands in the generic "non-casual" bucket of ternaries. Don't assume it behaves like an unset/default field when reasoning about expected output.
- The `CalorieBreakdown` object (bmr, ageGroup, activityMultiplier, baseTdee, exerciseCaloriesAdded, calorieFloor, weightLossDeficit, muscleGainSurplus, finalCalorieTarget, proteinTargetG) is logged via `console.info("[calorie-breakdown]", ...)` but intentionally NOT part of the public `GeneratedPlan` return type, to avoid rippling into API/DB schema. Test it with `vi.spyOn(console, "info")` rather than expanding the return type.
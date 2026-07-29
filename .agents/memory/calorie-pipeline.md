---
name: Calorie pipeline
description: Calorie targets must keep activity-level TDEE and explicit workout burns mutually exclusive.
---

The calorie pipeline uses a profile activity multiplier when available; that multiplier already includes usual workouts, so scheduled workout calories must not be added again. Legacy profiles without activity level use a sedentary base and add explicit scheduled exercise burns only on active days.

**Why:** Adding workout calories on top of a high/very-active multiplier can inflate weight-loss targets and make the same workout count twice.

**How to apply:** Preserve the breakdown fields (BMR, multiplier, base TDEE, exercise addition, maintenance, deficit, final target) whenever changing calorie logic, and verify both profile-activity and legacy fallback paths.

## Age-aware safety (under-18 vs adult)

Minors (age < 18) use the National Academies Dietary Reference Intakes (2023) adolescent EER equations, reproduced in Health Canada's official DRI table (updated 2025-11-19), instead of an adult BMR/TDEE formula. The source has separate growth terms for ages 9–<14 and 14–<19: males use +25/+20 kcal and females +30/+20 kcal respectively; the sex/activity coefficient sets are otherwise shared. The app maps its labels explicitly: sedentary→inactive, light→low active, moderate/high→active, extra_active→very active. All users pursuing fat loss use a 15% deficit from correctly calculated maintenance; age-specific calorie floors still apply:
- Fat-loss deficit: round(maintenance × 15%) for every age; timeline pressure does not replace the standard percentage.
- Muscle-gain surplus: adults 250/300/400(extreme), capped 250–400 at max 0.8 lb/wk. Minors 200/300 — **no extreme-discipline path** — capped 150–300 at max 0.5 lb/wk.
- Recomp surplus: adults 75(casual)/100. Minors always flat 75 regardless of commitment.
- Calorie floor: adults 1500(M)/1200(F). Minors 1800(M)/1600(F).
- Protein is age-independent and goal-based: fat loss/muscle gain use 0.8–1.0 g/lb of goal/target weight (current implementation uses 1.0 g/lb), while maintenance/recomp uses 0.8 g/lb; targets round to the nearest 5g and cap at 250g.

**Why:** The prior implementation intentionally avoided a pediatric equation because it had not been verified. The authoritative DRI source is now verified and directly matches the app's available inputs (age, sex, height, weight, activity category), so using it is safer and more appropriate than substituting Mifflin-St Jeor for adolescents. The equation source is https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html, under “Children and adolescents 3 to 18 years” → the “Age 9 years to <14 years” and “Age 14 years to <19 years” tables.

**How to apply:** Any future change to deficit/surplus/floor constants must update both the adult and minor branch deliberately — they are intentionally different, not a shared constant with an age multiplier.

## Gotchas

- `commitmentLevel: "committed"` is NOT a neutral/default value — it fails every `=== "casual"` and `=== "extreme_discipline"` check, so it always lands in the generic "non-casual" bucket of ternaries. Don't assume it behaves like an unset/default field when reasoning about expected output.
- The `CalorieBreakdown` object (including `eer`, `energyEquation`, `activityCategory`, and nullable adolescent `bmr`) is logged via `console.info("[calorie-breakdown]", ...)` but intentionally NOT part of the public `GeneratedPlan` return type, to avoid rippling into API/DB schema. Test it with `vi.spyOn(console, "info")` rather than expanding the return type.
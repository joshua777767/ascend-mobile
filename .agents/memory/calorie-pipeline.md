---
name: Calorie pipeline
description: Calorie targets must keep activity-level TDEE and explicit workout burns mutually exclusive.
---

The calorie pipeline uses a profile activity multiplier when available; that multiplier already includes usual workouts, so scheduled workout calories must not be added again. Legacy profiles without activity level use a sedentary base and add explicit scheduled exercise burns only on active days.

**Why:** Adding workout calories on top of a high/very-active multiplier can inflate weight-loss targets and make the same workout count twice.

**How to apply:** Preserve the breakdown fields (BMR, multiplier, base TDEE, exercise addition, maintenance, deficit, final target) whenever changing calorie logic, and verify both profile-activity and legacy fallback paths.

## Age-aware safety (under-18 vs adult)

Minors (age < 18) use the National Academies Dietary Reference Intakes (2023) adolescent EER equations, reproduced in Health Canada's official DRI table (updated 2025-11-19), instead of an adult BMR/TDEE formula. The source has separate growth terms for ages 9–<14 and 14–<19: males use +25/+20 kcal and females +30/+20 kcal respectively; the sex/activity coefficient sets are otherwise shared. The app maps its labels explicitly: sedentary→inactive, light→low active, moderate/high→active, extra_active→very active. Weight-loss and weight-gain goal adjustments are age-independent; age-specific equations and calorie floors still apply:
- Fat-loss deficit: round(maintenance × 20%), capped at 750 kcal/day; timeline pressure does not replace the standard percentage.
- Muscle-gain surplus: round(maintenance × 15%), capped at 600 kcal/day; timeline pressure does not replace the standard percentage.
- Recomp surplus: adults 75(casual)/100. Minors always flat 75 regardless of commitment.
- Calorie floor: adults 1500(M)/1200(F). Minors 1800(M)/1600(F).
- Protein is age-independent and goal-based: fat loss/muscle gain use 0.8–1.0 g/lb of goal/target weight (current implementation uses 1.0 g/lb), while maintenance/recomp uses 0.8 g/lb; targets round to the nearest 5g and cap at 250g.
- Every generated plan path, including recomp/fat-to-muscle and non-weight goals, must pass through one centralized protein-target calculation so no goal can silently omit protein.
- The current-plan endpoint must select and self-heal the newest saved plan from the current profile; otherwise an older recomp plan can display stale calories/protein after a goal change.

**Why:** The prior implementation intentionally avoided a pediatric equation because it had not been verified. The authoritative DRI source is now verified and directly matches the app's available inputs (age, sex, height, weight, activity category), so using it is safer and more appropriate than substituting Mifflin-St Jeor for adolescents. The equation source is https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html, under “Children and adolescents 3 to 18 years” → the “Age 9 years to <14 years” and “Age 14 years to <19 years” tables.

**How to apply:** Keep the goal-adjustment rates and caps shared across ages. Only the energy equations, calorie floors, and other explicitly age-specific safety rules should branch by age.

**Safety rule:** Apply the configured calorie floor after every goal branch, including maintenance and weight gain; unusually small users can otherwise receive targets below the minimum safe intake.

**Why:** A broad age/weight/activity matrix exposed that gain and maintenance paths bypassed the floor even though fat loss already clamped to it.

**How to apply:** Validate the served target, not only the raw maintenance and adjustment arithmetic, against the sex- and age-specific floor.

## Gotchas

- `commitmentLevel: "committed"` is NOT a neutral/default value — it fails every `=== "casual"` and `=== "extreme_discipline"` check, so it always lands in the generic "non-casual" bucket of ternaries. Don't assume it behaves like an unset/default field when reasoning about expected output.
- The `CalorieBreakdown` object (including `eer`, `energyEquation`, `activityCategory`, and nullable adolescent `bmr`) is logged via `console.info("[calorie-breakdown]", ...)` but intentionally NOT part of the public `GeneratedPlan` return type, to avoid rippling into API/DB schema. Test it with `vi.spyOn(console, "info")` rather than expanding the return type.
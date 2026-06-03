---
name: Project Upgrade design system
description: Visual identity tokens and data field gotchas for the project-upgrade web artifact
---

# Project Upgrade — design system

Premium mobile-first health-app look (NOT the old black/orange monospace).

- Palette lives as HSL CSS tokens in `artifacts/project-upgrade/src/index.css`: background `220 49% 8%`, card `222 39% 11%`, elevated `222 38% 15%`, border `215 28% 17%`, primary blue `217 91% 60%`, success green `160 84% 39%`, warning `38 92% 50%`. Custom tokens `--success`, `--warning`, `--elevated` are exposed via `@theme inline` (use `bg-success`, `text-success`, `bg-elevated`).
- Font: Inter (loaded in `index.html` + `--font-sans`). `--radius: 1rem`. Avoid uppercase/letter-spacing "aggressive" styling — use sentence/title case, rounded-2xl cards, rounded-full chips.
- **Why:** user explicitly rejected the harsh look; keep any new surface (error states, new pages) on these tokens so nothing reverts to black/orange.

## Data field gotchas (generated API types)
- `CoachReview` score field is **`dailyScore`** (number), not `score`. Source via `useGetTodayReview`.
- Plan has real targets: `calorieTarget`, `proteinTargetG`, `waterTargetL`, `stepsTarget`, `sleepTargetHours`, `coachNotes`, `keyHabits`, `warnings`. Plan generation is local BMR/TDEE math (no AI).
- Dashboard redirects to `/onboarding` when `useGetUserProfile` errors (empty DB) — this is the intended "no demo data" behavior, not a bug.

## Verifying dashboard with empty DB
- DB is intentionally empty. To smoke-test the dashboard, POST `/api/users/profile` then POST `/api/plans/current` (empty body) via `localhost:80`, screenshot, then clean up with `DELETE FROM plans; DELETE FROM user_profiles;`. Tables are `user_profiles` and `plans`.

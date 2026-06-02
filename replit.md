# Project Upgrade

A premium mobile-first AI transformation coaching web app. Users get a strict AI coach that generates personalized daily schedules, meal feedback, workouts, nightly reviews, weekly adjustments, and a coach chat — all built around their real life and goals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied to /api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild composite libs (run this after changing lib/db schema)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `OPENAI_API_KEY` — for AI coach features (meal feedback, coach chat, daily reviews, weigh-in adjustments)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter routing, shadcn/ui, TailwindCSS v4, recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: OpenAI GPT-4o-mini

## Where things live

- DB schema: `lib/db/src/schema/` — one file per table (userProfiles, plans, workouts, meals, journalEntries, coachReviews, weighIns, chatMessages)
- OpenAPI spec: `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
- API routes: `artifacts/api-server/src/routes/` — one file per domain
- AI lib helpers: `artifacts/api-server/src/lib/` — openai.ts, planGenerator.ts, scheduleGenerator.ts, workoutGenerator.ts
- Frontend pages: `artifacts/project-upgrade/src/pages/`
- Theme/design: `artifacts/project-upgrade/src/index.css`

## Architecture decisions

- Single-user MVP: `USER_ID = 1` hardcoded throughout — no auth
- All array fields (goals, keyHabits, skinConcerns, etc.) stored as JSON text in Postgres, parsed on read
- AI features use `gpt-4o-mini` for speed and cost; all have graceful fallbacks if OpenAI fails/quota exceeded
- Plan generation is done locally (BMR/TDEE math) — no AI needed for the plan itself
- Schedule and workout generation are deterministic algorithms, not AI

## Product

- 14 screens: Landing, Onboarding (5-step), Dashboard, Schedule, Workouts, Meals, Coach Chat, Journal, Progress, Pricing
- Onboarding collects ~30 profile fields and generates a fully personalized plan
- Each meal logged gets instant AI coach feedback (quality, what was good/bad, fix for next meal)
- Nightly journal generates a scored daily review (0–100) with exact fixes for tomorrow
- Weekly weigh-in generates a plan adjustment from AI
- Coach chat is context-aware: knows the user's profile, plan, and conversation history
- Dark mode forced; electric amber/gold (#F59E0B) accent; Space Mono font

## Gotchas

- After changing `lib/db` schema, run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck`
- The API server bundles with esbuild — after route changes, restart the workflow to rebuild
- DB push required after schema changes: `pnpm --filter @workspace/db run push`
- OpenAI 429 (quota exceeded) returns HTML error from Express — all routes have try/catch with graceful fallbacks

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

---
name: Project Upgrade stack
description: Key non-obvious build decisions for this app that affect future development
---

## Critical build order

When adding new tables to `lib/db/src/schema/`:
1. Create the file in `lib/db/src/schema/`
2. Export from `lib/db/src/schema/index.ts`
3. Run `pnpm run typecheck:libs` (rebuilds composite lib declarations)
4. Run `pnpm --filter @workspace/db run push` (applies schema to Postgres)
5. THEN run api-server typecheck — skipping step 3 causes "no exported member" errors

**Why:** `lib/db` is a composite lib; its declarations are stale until `tsc --build` runs. Leaf packages (api-server) can't see new exports until the lib is rebuilt.

## Single-user pattern

USER_ID = 1 is hardcoded in `artifacts/api-server/src/routes/users.ts` and imported by all other route files. This is intentional for the MVP.

## Array fields in Postgres

Goals, keyHabits, skinConcerns, digestionConcerns are stored as JSON text strings in Postgres. Always `JSON.stringify()` on write, `JSON.parse()` on read.

## AI mutations that take no body

`useGeneratePlan` and `useGenerateReview` mutations take no request body. Call as `mutation.mutateAsync(undefined as any)` — passing `{}` causes TypeScript error TS2345.

## OpenAI error handling

All AI routes (meals, chat, reviews, weighins) have try/catch that returns sensible fallback data if OpenAI fails. The error is swallowed, not propagated — user experience is preserved even with API quota issues.

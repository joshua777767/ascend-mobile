---
name: Auth architecture
description: How Ascend's email+password auth is wired — decisions worth knowing for future changes.
---

# Auth Architecture

## What's in place (fully shipped)
- `express-session` + `connect-pg-simple` (table: `session`) — session stored in Postgres
- `SESSION_SECRET` env var required on startup (throws if missing)
- `scrypt` password hashing in `artifacts/api-server/src/lib/password.ts`
- `requireAuth` middleware in `artifacts/api-server/src/middlewares/auth.ts` — mounted as a single blanket middleware in `routes/index.ts` covering ALL data routers
- `getUserId(req)` helper — throws if no session, used in every data route (no hardcoded USER_ID anywhere)
- Session type augmented: `SessionData.userId?: number`

## Key conventions
- All data routes use `getUserId(req)` — never hardcode a user ID
- `userProfilesTable` has `userId` FK with `onDelete: "cascade"` to `usersTable`
- Reset profile route (`DELETE /users/profile`) wipes ALL user data in correct dependency order (chat → weighins → reviews → journal → meals → workouts → plans → profile)
- `custom-fetch.ts` always sends `credentials: "include"` so cookies attach on every request

**Why:** per-user data isolation via session — removing hardcoded USER_ID=1 was the entire point.

## Frontend flow
- `useAuth` hook wraps `useGetMe` — 401 = not signed in (normal), 5xx = server error (shown to user)
- `useFirstLoadSpinner` latches to prevent spinner re-triggering on background refetches
- Route guards in `App.tsx`: unauthenticated → /login; auth but no profile → /onboarding
- Settings page: logout clears queryClient + redirects /login; reset profile clears all data + redirects /onboarding

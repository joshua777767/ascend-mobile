---
name: Multi-user data scoping
description: How per-user isolation was added to Ascend and the class of bug a bulk USER_ID replacement misses
---

# Per-user data isolation in Ascend

Ascend started single-user (`USER_ID = 1` hardcoded). Auth was added with express-session + connect-pg-simple (Postgres store) and scrypt hashing. `req.session.userId` replaces the constant.

## The trap: routes that query by record id, not by user

A bulk find-replace of `USER_ID` → `getUserId(req)` only fixes routes that already filtered by user. **Routes that look up a row by its primary key (`/:id`) had no USER_ID to replace, so they were silently left wide open** — an IDOR where any authed user reads/mutates another user's row by guessing the id.

**Why:** the sed/replace approach is keyed on the old constant; it cannot find places that never referenced it.

**How to apply:** after any single-user→multi-user migration, audit *every* route that takes an `:id` param and confirm the query filters by BOTH `id` AND `userId` (return 404 when not owned), e.g. `where(and(eq(t.id, id), eq(t.userId, getUserId(req))))`. Don't trust the bulk replacement alone — grep for `/:id` handlers.

## Other conventions
- Regenerate the session (`req.session.regenerate`) before setting `userId` on login/signup to prevent session fixation.
- `user_profiles.user_id` is notNull + unique + FK→users(id) onDelete cascade; profile writes never accept a client-supplied userId.

---
name: React Query auth-gate spinner loop
description: Why gating a whole route tree on a React Query isLoading caused an infinite spinner + request flood, and the fix pattern.
---

# React Query gate oscillation → infinite spinner + refetch flood

A top-level router/guard that does `if (query.isLoading) return <Spinner/>` can create an
infinite mount/unmount loop when the query ERRORS (no data):

1. Query errors → `isLoading` false → guard renders children.
2. A child also subscribes to the SAME query (new observer) → React Query refetch-on-mount
   (errored queries are always stale) → `isLoading` flips true.
3. Guard re-renders spinner → child UNMOUNTS → fetch settles → child remounts → loop.
   Symptom: endless spinner + the endpoint flooded (~20 req/s, here `/api/auth/me` 401s).

**Why:** success queries keep `isLoading` false during refetch (they have data), so only
ERRORED queries (no data) flip `isLoading` and trigger the unmount loop.

**How to apply / fix:** never let a guard re-block the tree after the FIRST resolution.
Latch a "first load done" flag (useRef set once `!isLoading`) plus a hard timeout fallback,
so background refetches that flip `isLoading` can't unmount children. Apply to every guard
that gates a subtree on a query's loading state. Also classify expected auth states (401 =
signed-out, normal) vs real failures (non-401 → readable error screen, not a spinner).

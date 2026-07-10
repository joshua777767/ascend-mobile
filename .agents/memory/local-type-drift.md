---
name: Local type vs generated type drift
description: When a mobile component defines its own local TypeScript type instead of using the generated API client type, field names can silently mismatch the API response.
---

The `MealEntry` type in `meals.tsx` defined `aiFeedback?: string` as a local type, but the Drizzle schema maps `coach_feedback` → `coachFeedback`, and the OpenAPI spec also uses `coachFeedback`. The component was checking `meal.aiFeedback` which was always `undefined`, causing the "AI feedback unavailable" message to always show.

**Why:** The generated types from `@workspace/api-client-react` are the source of truth. Local type definitions in components can become stale if the API field name changes. The generated hook returns the OpenAPI-spec field names — use those.

**How to apply:** When a field seems to always be null/undefined in a component, first check what field name the API actually returns (via OpenAPI spec or DB schema → Drizzle mapping), not what the local component type says.

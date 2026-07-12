---
name: RC invalidateCustomerInfoCache destroys anonymous-merge data
description: Why invalidateCustomerInfoCache must NOT be called in startup or foreground refresh for this app.
---

# RC invalidateCustomerInfoCache destroys anonymous-merge data

## The rule
Never call `Purchases.invalidateCustomerInfoCache()` in the startup sequence or foreground refresh for this app.

**Why:** The subscription was purchased under `$RCAnonymousID:f09af330229c4e83b729a3f37fabeb05`. After the first `logIn(userId)` call, RC merged anonymous→userId and the SDK cached the merged CustomerInfo correctly. Calling `invalidateCustomerInfoCache()` destroys that local cache and forces a raw server fetch for the Ascend userId. The server returns not-Pro because the subscription is stored server-side under the anonymous ID, not the numerical userId.

**How to apply:**
- Startup: skip invalidation entirely. Comment explains why.
- Foreground refresh: same — skip. RC manages its own 5-min cache TTL.
- The `app/debug-subscription.tsx` screen was the diagnostic tool that revealed this: it calls `getCustomerInfo()` directly (no invalidation) and always returns Pro correctly. That asymmetry was the clue.
- If RC cache expiry is ever needed in future, use `Purchases.getCustomerInfo()` with `fetchPolicy: FETCH_CURRENT_CACHE_AND_REFRESH_IF_STALE` (if available) rather than manual invalidation.

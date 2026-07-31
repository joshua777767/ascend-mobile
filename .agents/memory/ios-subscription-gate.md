---
name: iOS subscription hard-gate
description: How iOS Pro access is gated end-to-end (no backend auto-trial; RevenueCat-only entitlement).
---

# iOS subscription hard-gate (ascend-mobile)

New users get **no automatic backend trial**. Flow: signup → native onboarding →
paywall (hard gate) → Pro granted **only** when RevenueCat confirms active
entitlement `"pro"`. Expired/canceled → back to paywall.

**Why:** product decision — the 7-day free trial is the Apple/RevenueCat IAP
intro offer, not a server-side grant. Backend trial dates being auto-set on
signup made everyone look "in trial" and bypassed the paywall.

## Rules / how to apply
- Backend `publicUser` (auth.ts): a trial only counts when BOTH `trialStartDate`
  and `trialEndDate` are explicitly present. No `createdAt + 7d` fallback. Signup
  insert must NOT set trial dates. `hasAccess = isFreePro || explicitTrial || paid`.
- Premium gating is **client-side**: `isPro` derives from RevenueCat entitlement
  `"pro"`. No server route enforces `hasAccess` for feature data (only admin.ts
  403s), so the mobile `AppGate` in `app/_layout.tsx` is the real gate.
- `AppGate` must **block render** (show LoadingScreen) while a signed-in user's
  profile query or subscription state is still loading — otherwise `(tabs)`
  renders for a frame before the redirect and a non-Pro user briefly gets in.
- `SubscriptionProvider` must re-key on `userId`: on logout (userId null) call
  `Purchases.logOut()` and clear `customerInfo`/`packages`; hold `isLoading` true
  across the switch. Otherwise the prior user's entitlement leaks to the next
  account and misclassifies them as Pro.
- RevenueCat must not initialize anonymously for new accounts: wait for the
  authenticated WebView user ID, configure with `appUserID`, and explicitly call
  `Purchases.logIn(userId)` for each authenticated account. Existing anonymous
  customers remain untouched.
- `AuthContext.logout()` calls `queryClient.clear()` so the previous account's
  profile/plan cache can't drive routing for the next user (profile query key is
  global/unscoped).

## Auth transport
Mobile auth is **session-cookie** based (connect.sid via connect-pg-simple). The
API issues NO bearer token. All mobile fetches use `credentials:"include"` and
`setAuthTokenGetter(() => null)`. An older AuthContext expected a token and threw
"No token returned", silently breaking mobile signup/login.

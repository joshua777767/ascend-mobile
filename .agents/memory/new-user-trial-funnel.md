---
name: New-user trial funnel gate exemption
description: Why AuthenticatedGate must exempt the signup funnel routes, and how LockedPaywall copy branches for new vs expired users.
---

**Rule:** The hard access gate (`AuthenticatedGate` in project-upgrade App.tsx) must NEVER block the new-user funnel routes (`/intro`, `/onboarding`, `/pricing`, public/legal pages). `PRE_ACCESS_ROUTES` holds the exempt list; only the catch-all app content stays gated.

**Why:** New users get NO backend trial by design — the Apple/RevenueCat intro offer IS their 7-day trial. When the gate was moved above the whole router without exemptions, a fresh signup instantly hit `LockedPaywall` with "Your 7-day trial has ended" and could never reach onboarding or the trial offer. This blocked all new-user conversions and an App Store submission.

**How to apply:** Any refactor of the gate/router must keep the funnel exemption AND the `isNewUser = !me?.trialUsed && !me?.trialEndDate` copy branch in `LockedPaywall` (new user → "Start your 7-day free trial" CTA; expired → "trial has ended"). Prod runs the last-published build — this fix only takes effect after re-publishing.

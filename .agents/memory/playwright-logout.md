---
name: Playwright logout hard-redirect
description: SPA logout must use window.location.replace not wouter setLocation to avoid auth state race condition.
---

**Rule:** In settings.tsx handleLogout, use `window.location.replace('/login')` not `setLocation('/login')` after calling queryClient.clear().

**Why:** After queryClient.clear(), React Query's useGetMe refetches. There's a window where isAuthed is still truthy (stale render) when the soft navigation fires. wouter's setLocation triggers the route guard synchronously — it sees isAuthed=true and redirects to /dashboard. window.location.replace forces a full page reload, bypassing all React state entirely.

**How to apply:** Any logout or session-invalidating action should use window.location.replace (or window.location.href) rather than a SPA router's navigate/setLocation call. This ensures clean React state regardless of React Query timing.

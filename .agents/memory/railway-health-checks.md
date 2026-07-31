---
name: Railway health checks
description: Keep deployment health checks independent from application dependencies that may still be starting.
---

The Railway health endpoint must be registered before database-backed session middleware and other application dependencies. The HTTP server must also explicitly bind to `0.0.0.0` on Railway's injected `PORT`. The health response should be small and based only on the process being alive.

**Why:** Railway can complete build and deploy, then fail the service if the health request waits on a database-backed session store or the container only binds to a non-routable interface.

**How to apply:** Mount the platform health route at the app level before session setup, and call the server listener with the injected port plus host `0.0.0.0`; leave authenticated and database-dependent routes unchanged.
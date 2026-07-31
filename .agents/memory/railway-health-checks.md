---
name: Railway health checks
description: Keep deployment health checks independent from application dependencies that may still be starting.
---

The Railway health endpoint must be registered before database-backed session middleware and other application dependencies. It should return a small successful response based only on the process being alive.

**Why:** Railway can complete build and deploy, then fail the service if the health request waits on a database-backed session store during startup.

**How to apply:** Mount the platform health route at the app level before session setup; leave authenticated and database-dependent routes unchanged.
---
name: GitHub push fallback
description: Secure repository publishing when the normal Replit Git push credential is unavailable
---

When the normal Git push helper reports missing GitHub source-control credentials, an already-authorized GitHub connector may still have repository write access. Use its authenticated GitHub API to update only the intended files and verify the resulting remote branch and commit.

**Why:** The workspace can have a configured GitHub remote and an added GitHub integration while the Git helper’s separate source-control credential is unavailable.

**How to apply:** Prefer the normal Git push first. If it fails with `NO_CREDENTIALS`, use the connected GitHub integration only when its repository permissions confirm `push: true`; never ask the user for a token.
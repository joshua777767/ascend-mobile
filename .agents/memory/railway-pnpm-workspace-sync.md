---
name: Railway pnpm workspace sync
description: Prevent frozen Railway installs from failing when workspace manifests and the lockfile come from different revisions.
---

Railway's frozen install checks every workspace package, not just the root package.json. The lockfile and all workspace package manifests must be generated and published from the same revision.

**Why:** A root lockfile can be locally valid while Railway rejects it if any workspace package.json on the connected GitHub branch is older or newer than the lockfile.

**How to apply:** When diagnosing ERR_PNPM_OUTDATED_LOCKFILE, compare every workspace package.json with pnpm-lock.yaml, regenerate with Railway's pnpm settings, validate with a frozen install, and publish the synchronized set together.
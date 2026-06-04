---
name: Orval naming conflict
description: How to name OpenAPI request-body schemas to avoid TS2308 duplicate-export errors in the generated zod package.
---

## The rule
Name request-body schemas with an `Input` suffix (e.g. `LogWaterInput`), **not** a `Body` suffix.

## Why
Orval generates two outputs for every request body schema:
1. A TypeScript interface in `lib/api-zod/src/generated/types/<camelName>.ts`, named exactly after the schema (e.g. `LogWaterBody`).
2. A Zod const in `lib/api-zod/src/generated/api.ts`, named `<OperationId>Body` (e.g. `LogWaterBody` for operation `logWater`).

`lib/api-zod/src/index.ts` re-exports both via `export * from "./generated/api"` and `export * from "./generated/types"`. When both emit the same name, TypeScript raises **TS2308** ("has already exported a member named X — consider explicitly re-exporting").

## How to apply
Use the pattern already established for existing endpoints:
- Schema in openapi.yaml: `LogWaterInput` (Input suffix)
- Generated TS interface: `LogWaterInput` (from types/logWaterInput.ts)
- Generated Zod const: `LogWaterBody` (from api.ts, based on operationId `logWater`)
- No name collision → no TS2308

Existing examples that follow this correctly: `LoginInput` → Zod const `LoginBody`, `SignupInput` → Zod const `SignupBody`.

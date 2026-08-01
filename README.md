# Ascend

Ascend is an AI fitness and wellness app with a React web client, an Express
API, PostgreSQL, and a native Expo WebView shell.

## Production architecture

- **Railway:** hosts the API, serves the built React frontend, and provides
  PostgreSQL.
- **Expo EAS:** builds and distributes the native iOS/Android shell.
- **RevenueCat:** handles native subscriptions.
- **OpenAI:** powers the AI coach features.

The Railway service is configured by `railway.json`. It builds the frontend
first, then bundles the API. The API serves `/api/*` and serves the React SPA
for all other routes.

## Local development

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/project-upgrade run dev
pnpm run typecheck
pnpm run build
```

Required API environment variables:

- `DATABASE_URL`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `APP_BASE_URL` (production: `https://ascendfit.fitness`)
- `RESEND_API_KEY` for password reset email delivery
- `REVENUECAT_WEBHOOK_SECRET` for subscription webhook verification

Railway supplies `PORT`. The database migration/schema files are in
`lib/db` and the API’s database readiness check is available at
`/api/healthz/db`.
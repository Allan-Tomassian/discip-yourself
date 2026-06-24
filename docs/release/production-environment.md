# Production Environment Validation

This checklist validates a production/TestFlight release without printing or storing secret values.
Use placeholders in docs and tickets. Never paste real tokens into tracked files.

## Automated Checks

Run after setting production values in the shell or passing untracked env files:

```sh
npm run release:env-check -- --frontend-env .env.production.local --backend-env backend/.env.production.local --production-origin https://<PRODUCTION_WEB_ORIGIN>
npm run build
npm run release:bundle-check
PRODUCTION_WEB_ORIGIN=https://<PRODUCTION_WEB_ORIGIN> npm run release:smoke
```

Authenticated AI smoke is opt-in and low quota:

```sh
PRODUCTION_WEB_ORIGIN=https://<PRODUCTION_WEB_ORIGIN> \
PRODUCTION_SMOKE_AUTH_TOKEN=<TEMPORARY_ACCESS_TOKEN> \
PRODUCTION_SMOKE_AI_ROUTES=coach,session-guidance,day-analysis,system-analysis \
npm run release:smoke
```

Rules:
- Do not commit smoke tokens.
- Do not print token values.
- Run at most one request per enabled AI route.
- Keep live smoke as an explicit release command, not a normal unit test.

## Render Dashboard

Required production values:
- `APP_ENV=prod`
- `AI_QUOTA_MODE=normal`
- `CORS_ALLOWED_ORIGINS=https://<PRODUCTION_WEB_ORIGIN>,capacitor://localhost`
- `CORS_ALLOW_PRIVATE_NETWORK_DEV=false`
- `SUPABASE_URL=https://<PRODUCTION_PROJECT_REF>.supabase.co`
- `SUPABASE_SECRET_KEY=<BACKEND_ONLY_SERVICE_ROLE_SECRET>`
- `OPENAI_API_KEY=<SERVER_ONLY_OPENAI_KEY>`

Model pins:
- Verify every configured model with a controlled live request before finalizing.
- Do not assume account credit proves model access.
- Keep deep routes pinned intentionally; do not rely on accidental global fallback.

Logging:
- Confirm logs exclude prompts, auth headers, access tokens, refresh tokens, OpenAI keys, Supabase service-role keys, and raw secret values.
- Health should return `service=ai-backend` and `appEnv=prod`.

## Frontend Hosting And Native Build

Required production values:
- `VITE_APP_ENV=prod`
- `VITE_AI_BACKEND_URL=https://discip-yourself-backend.onrender.com`
- `VITE_SUPABASE_URL=https://<PRODUCTION_PROJECT_REF>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLIC_SUPABASE_KEY>`

Forbidden in production runtime:
- active Vite `/api` dev proxy
- `VITE_USE_DEV_API_PROXY=true`
- localhost URLs
- `127.0.0.1`
- private LAN URLs
- staging or placeholder app identity

Capacitor iOS:
- Backend CORS must allow `capacitor://localhost`.
- Supabase Auth redirects must be verified on a real TestFlight build.

## Supabase Dashboard

Verify:
- linked production project matches frontend/backend env values
- migrations are applied
- required tables exist: `profiles`, `user_data`, `billing_entitlements`, `ai_request_logs`
- RLS is enabled and user-owned tables remain user-scoped
- service-role secret is backend-only
- frontend uses only the publishable public key
- Auth redirect allow-list includes production web callbacks
- native auth callbacks are added only after confirming the actual TestFlight redirect origin

Suggested read-only checks:

```sh
supabase projects list
supabase migration list --linked
cd backend && node src/scripts/checkSchema.js
```

## OpenAI Dashboard

Verify:
- billing is active
- current project key is installed on Render only
- each configured model name is available to the project
- one controlled request succeeds for each configured model class
- timeout and quota behavior is intentional

Do not expose API keys in screenshots, logs, or release notes.

## CORS Release Contract

Allowed:
- `https://<PRODUCTION_WEB_ORIGIN>`
- `capacitor://localhost`

Rejected:
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://192.168.1.10:5173`
- arbitrary external origins

Use `npm run release:smoke` to verify OPTIONS behavior without changing backend CORS.

## Bundle Review

After `npm run build`, run:

```sh
npm run release:bundle-check
```

Blocking findings:
- localhost or private LAN URLs
- active Vite `/api` proxy calls
- placeholder bundle id `com.company.discipyourself`
- secret-looking tokens

Non-blocking notices:
- harmless source strings that remain runtime-gated, such as dev proxy labels or e2e markers.
- dev reset strings that are hidden in production by the app environment gate.

Investigate notices when related gates change.

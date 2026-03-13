# AI Backend

Minimal backend for Discip-Yourself AI V1.

`billing_entitlements` is the only server-trusted premium source for AI routes.
Do not derive AI quota or access from frontend `profile.plan` / `profile.entitlements`.

## Env

Required:

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional for AI calls:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `LOG_LEVEL`

Client integration:

- frontend should call this service with the user's Supabase bearer token
- set `VITE_AI_BACKEND_URL` in the app to the backend base URL

## Run locally

```bash
cd backend
npm install
PORT=3001 \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
OPENAI_API_KEY= \
LOG_LEVEL=info \
npm run dev
```

## Test

```bash
cd backend
npm test
```

## Check required Supabase tables

```bash
cd backend
PORT=3001 \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
npm run check:schema
```

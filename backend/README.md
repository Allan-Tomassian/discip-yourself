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
- `AI_QUOTA_MODE`
- `CORS_ALLOWED_ORIGINS`
- `LOG_LEVEL`

Client integration:

- frontend should call this service with the user's Supabase bearer token
- set `VITE_AI_BACKEND_URL` in the app to the backend base URL
- `CORS_ALLOWED_ORIGINS` should include local dev and deployed frontend origins

## Run locally

```bash
cd backend
npm install
PORT=3001 \
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
OPENAI_API_KEY= \
AI_QUOTA_MODE=dev_relaxed \
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 \
LOG_LEVEL=info \
npm run dev
```

Example Render value:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.example
```

Quota mode:

- `AI_QUOTA_MODE=normal`: quotas produit normaux, valeur par défaut
- `AI_QUOTA_MODE=dev_relaxed`: plafonds très élevés pour tests IA en local ou sur un backend de test

N'active pas `dev_relaxed` en production.

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

## Remise à niveau Supabase minimale

Pour ouvrir l'app sans erreur `profiles` / `user_data`, applique au minimum:

1. `supabase/migrations/20260216130000_create_user_data.sql`
2. `supabase/migrations/20260216162000_create_profiles.sql`

Pour tester réellement `/ai/now`, applique aussi:

3. `supabase/migrations/20260306120000_create_billing_entitlements.sql`
4. `supabase/migrations/20260306120100_create_ai_request_logs.sql`

Commande CLI de référence:

```bash
cd "/Users/allan/Desktop/discip-yourself code"
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

Fallback SQL:

```bash
cd "/Users/allan/Desktop/discip-yourself code"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260216130000_create_user_data.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260216162000_create_profiles.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260306120000_create_billing_entitlements.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260306120100_create_ai_request_logs.sql
```

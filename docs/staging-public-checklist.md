# Staging public multi-device

Objectif:

- front public stable
- backend IA public stable
- pas de dépendance au LAN pour tester iPhone / Android / desktop
- séparation claire `local / staging / prod`

## Stack retenue

- front staging: Netlify
- backend staging: Render
- données/auth staging: projet Supabase séparé

## Front staging

Variables Netlify:

- `VITE_APP_ENV=staging`
- `VITE_SUPABASE_URL=https://<staging-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<staging-anon-key>`
- `VITE_AI_BACKEND_URL=https://discip-yourself-backend-staging.onrender.com`

Notes:

- ne jamais exposer `OPENAI_API_KEY`
- ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY`
- utiliser `netlify.toml` pour le build Vite et le fallback SPA

## Backend staging

Variables Render:

- `APP_ENV=staging`
- `PORT=3001`
- `SUPABASE_URL=https://<staging-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>`
- `OPENAI_API_KEY=<server-only>`
- `OPENAI_MODEL=gpt-4.1-mini`
- `AI_QUOTA_MODE=normal`
- `CORS_ALLOW_PRIVATE_NETWORK_DEV=false`
- `CORS_ALLOWED_ORIGINS=https://staging-discip-yourself.netlify.app,http://localhost:5173,http://127.0.0.1:5173`
- `LOG_LEVEL=info`

## Local

Front local:

- copier `.env.local.example` vers `.env.local`
- pointer `VITE_AI_BACKEND_URL` vers le backend local

Backend local:

- copier `backend/.env.example` vers un env shell local
- activer `CORS_ALLOW_PRIVATE_NETWORK_DEV=true` seulement pour les tests LAN réels

## Vérifications minimales

Front staging:

- ouvrir l’URL Netlify sur iPhone, Android et desktop
- vérifier connexion Supabase
- vérifier `Coach`
- vérifier `Today`
- vérifier `Planning`

Backend staging:

- `GET /health`
- `POST /ai/chat`
- `POST /ai/now`
- vérifier CORS depuis l’origine Netlify staging

## Checklist Coach

- ouvrir la bulle Coach
- discuter en mode libre
- activer `Plan` dans le même chat
- proposer un plan
- créer
- voir l’état `Création...`
- voir le succès
- cliquer `Voir dans l’app`
- revenir au chat via `Continuer`

## Commandes utiles repo

- `npm run check:env:public`
- `cd backend && npm test`
- `npm run test:unit`
- `npm run build`

# Checklist iPhone LAN pour le Coach et l'IA

## Cible recommandée

Pour le correctif prioritaire Coach:

- validation par défaut = **front local + backend local**
- le chemin `front local/LAN -> backend public` n'est pas la voie de debug recommandée
- si tu gardes un backend public avec une origine privée/LAN, il faut autoriser explicitement cette origine côté backend public

- Front iPhone: `http://192.168.1.183:5173`
- Backend local: `http://192.168.1.183:3001`

## 1. Frontend

Le front lit `VITE_AI_BACKEND_URL` au démarrage Vite.

Pour pointer vers le backend local, utiliser temporairement:

```bash
VITE_AI_BACKEND_URL=http://192.168.1.183:3001 npm run dev:lan
```

Alternative via `.env` local non versionné:

```bash
VITE_AI_BACKEND_URL=http://192.168.1.183:3001
```

Puis relancer `npm run dev:lan`.

Important:

- si Vite était déjà lancé, il faut l'arrêter puis le relancer
- tant que Vite n'est pas relancé, l'iPhone continue de viser l'ancienne URL

## 2. Backend

Le backend lit `process.env` au démarrage. Modifier un fichier `.env` sans le sourcer ne change rien au process déjà lancé.

Commande de référence:

```bash
cd "/Users/allan/Desktop/discip-yourself code/backend"

PORT=3001 \
SUPABASE_URL="https://humfatlgvwafmbohrdip.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="TON_SERVICE_ROLE_KEY" \
OPENAI_API_KEY="TON_OPENAI_API_KEY" \
AI_QUOTA_MODE=dev_relaxed \
CORS_ALLOW_PRIVATE_NETWORK_DEV=true \
CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173" \
LOG_LEVEL=info \
npm run dev
```

Important:

- `CORS_ALLOW_PRIVATE_NETWORK_DEV=true` doit être présent au démarrage
- si tu changes une variable backend, arrête puis relance `npm run dev`

## 3. Vérifications réseau minimales

### Santé backend

Ouvrir sur l'iPhone:

```text
http://192.168.1.183:3001/health
```

Résultat attendu:

```json
{"ok":true}
```

### Preflight CORS

Depuis le Mac:

```bash
curl -i -X OPTIONS "http://192.168.1.183:3001/ai/chat" \
  -H "Origin: http://192.168.1.183:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Attendu:

- statut `204`
- `access-control-allow-origin: http://192.168.1.183:5173`

Puis:

```bash
curl -i -X OPTIONS "http://192.168.1.183:3001/ai/now" \
  -H "Origin: http://192.168.1.183:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

## 4. Vérification fonctionnelle

Sur iPhone, ouvrir:

```text
http://192.168.1.183:5173
```

Puis tester:

- ouverture du `CoachPanel`
- envoi d'un message
- réponse visible
- ouverture de `coach-chat`
- nouvelle réponse visible
- relance d'une analyse `Today`

Avec `LOG_LEVEL=info`, le backend doit montrer:

- `OPTIONS /ai/chat` puis `POST /ai/chat`
- `OPTIONS /ai/now` puis `POST /ai/now`

## 5. Interprétation rapide

- `Coach indisponible sur cette origine de test` + aucun hit backend:
  - front mal redémarré
  - ou front encore sur Render
- `GET /health` fonctionne mais aucun `/ai/chat` ou `/ai/now`:
  - le front n'utilise pas le backend local
- hits backend avec `401`:
  - auth/session
- hits backend avec `429` ou `503`:
  - réseau OK, problème backend/quota/schema

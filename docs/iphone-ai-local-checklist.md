# Checklist iPhone LAN pour le Coach et l'IA

## Cible recommandée

En développement Vite, le navigateur ne contacte plus le backend Render directement.

```text
iPhone browser
-> http://<mac-lan-ip>:5173/api/...
-> Vite dev proxy
-> https://discip-yourself-backend.onrender.com/...
```

Le changement d'IP privée du Mac ou de l'iPhone ne nécessite donc plus d'ajout dans `ALLOWED_ORIGINS`.

## 1. Frontend

Variables locales recommandées:

```bash
VITE_DEV_API_PROXY_TARGET=https://discip-yourself-backend.onrender.com
VITE_AI_BACKEND_URL=https://discip-yourself-backend.onrender.com
```

`VITE_AI_BACKEND_URL` reste la base backend de production/preview. En développement Vite, le front utilise `/api` par défaut et `VITE_DEV_API_PROXY_TARGET` configure seulement la cible du proxy.

Pour ouvrir depuis le Mac uniquement:

```bash
npm run dev
```

Pour ouvrir depuis l'iPhone sur le LAN avec les scripts actuels:

```bash
npm run dev:lan
```

Important:

- si Vite était déjà lancé, il faut l'arrêter puis le relancer après un changement d'env
- l'iPhone doit ouvrir `http://<mac-lan-ip>:5173`
- les appels IA visibles dans le navigateur doivent viser `/api/...`

## 2. Vérifications réseau minimales

### Santé backend via proxy

Depuis le Mac:

```bash
curl -i "http://localhost:5173/api/health"
```

Depuis l'iPhone:

```text
http://<mac-lan-ip>:5173/api/health
```

Résultat attendu:

```json
{"ok":true}
```

### Appels IA attendus

Depuis l'app iPhone, déclencher une préparation IA ou un message Coach.

Le navigateur doit appeler:

```text
/api/ai/session-guidance
/api/ai/chat
/api/ai/day-analysis
```

Render doit recevoir les routes backend sans préfixe:

```text
POST /ai/session-guidance
POST /ai/chat
POST /ai/day-analysis
```

## 3. Interprétation rapide

- aucun hit `/api/...` dans le navigateur:
  - Vite n'a pas été relancé
  - ou le front utilise une version buildée/preview non dev
- hit `/api/...` mais réponse proxy indisponible:
  - vérifier `VITE_DEV_API_PROXY_TARGET`
  - vérifier que Render répond sur `/health`
- hits backend avec `401`:
  - auth/session
- hits backend avec `429` ou `503`:
  - réseau OK, problème backend/quota/schema

## 4. Mode backend local direct

Le mode direct vers un backend local reste possible uniquement si nécessaire:

```bash
VITE_USE_DEV_API_PROXY=false
VITE_AI_BACKEND_URL=http://<mac-lan-ip>:3001
npm run dev:lan
```

Dans ce mode direct, les règles CORS du backend local redeviennent applicables. Ce n'est pas le mode recommandé pour tester le backend Render depuis iPhone.

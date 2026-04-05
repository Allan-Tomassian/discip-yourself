# Rotation des secrets

## Variables normalisées

Frontend public seulement:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AI_BACKEND_URL`

Backend seulement:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Référentiel canonique de placeholders:

```bash
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

## Règles

- ne jamais exposer `OPENAI_API_KEY` côté client
- ne jamais exposer `SUPABASE_SECRET_KEY` côté client
- ne jamais créer de variable `VITE_*` contenant `OPENAI`, `SECRET`, `SERVICE_ROLE` ou `PRIVATE`
- la publishable key Supabase peut être lue côté frontend, jamais la secret key

## Checklist de rotation

1. Créer la nouvelle `OPENAI_API_KEY` dans le secret manager backend.
2. Créer ou mettre à jour la nouvelle `SUPABASE_SECRET_KEY` dans le secret manager backend.
3. Vérifier `SUPABASE_URL` et `VITE_SUPABASE_URL`.
4. Vérifier `VITE_SUPABASE_PUBLISHABLE_KEY` côté frontend.
5. Déployer le backend avec les nouvelles variables.
6. Déployer le frontend seulement si la publishable key ou l’URL ont changé.
7. Exécuter:
   - `npm run check:env:public`
   - `npm run check:env:secrets`
   - `npm run test:unit`
   - `npm run build`
8. Smoke tester:
   - login Supabase
   - `POST /ai/now`
   - `POST /ai/chat`
   - `POST /ai/local-analysis`
9. Révoquer les anciennes clés seulement après validation.

## Compatibilité transitoire

- frontend: `VITE_SUPABASE_ANON_KEY` reste tolérée en fallback, mais ne doit plus être utilisée dans les exemples ni les nouveaux déploiements
- backend: `SUPABASE_SERVICE_ROLE_KEY` reste tolérée en fallback, mais `SUPABASE_SECRET_KEY` devient le nom canonique

## Contrôles automatiques

- [scripts/check-no-public-secrets.mjs](/Users/allan/Desktop/discip-yourself%20code/scripts/check-no-public-secrets.mjs): interdit les secrets backend dans les variables publiques et bloque les anciens noms publics
- [scripts/check-no-secrets.mjs](/Users/allan/Desktop/discip-yourself%20code/scripts/check-no-secrets.mjs): échoue si un secret semble commité ou si un secret backend est lu dans `src/`

# Supabase AI Readiness

Base minimale requise avant d'activer `/ai/now` :

1. `public.user_data`
2. `public.profiles`
3. `public.billing_entitlements`
4. `public.ai_request_logs`

Ordre recommandé d'application des migrations :

1. `supabase/migrations/20260216130000_create_user_data.sql`
2. `supabase/migrations/20260216162000_create_profiles.sql`
3. `supabase/migrations/20260306120000_create_billing_entitlements.sql`
4. `supabase/migrations/20260306120100_create_ai_request_logs.sql`

Commande unique de référence :

```bash
supabase db push
```

Règles d'exploitation :

- `profiles` et `user_data` sont obligatoires au boot complet de l'app.
- `billing_entitlements` est la seule source de vérité serveur pour le premium IA.
- `profile.plan` et `profile.entitlements` restent des états UX côté app, pas des garanties backend.
- `ai_request_logs` est requis pour quotas, audit et anti-abus backend.
- Le backend doit être validé avec `npm run check:schema` avant d'ouvrir `/ai/now` sur un nouvel environnement.

Checklist avant IA :

- migrations appliquées sur le projet Supabase distant
- login OK
- création/chargement `profiles` OK
- lecture/écriture `user_data` OK
- présence de `billing_entitlements`
- présence de `ai_request_logs`
- backend `npm test` OK

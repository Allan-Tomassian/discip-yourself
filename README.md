# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## iPhone Coach / IA en LAN

Pour valider le Coach et les analyses IA sur iPhone avec un backend local, suivre:

- [docs/iphone-ai-local-checklist.md](/Users/allan/Desktop/discip-yourself%20code/docs/iphone-ai-local-checklist.md)

Pour le front, un exemple d'override local existe dans:

- [.env.local.example](/Users/allan/Desktop/discip-yourself%20code/.env.local.example)

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## iOS (Capacitor)

This project can be wrapped as an iOS app using Capacitor.

## How to run

Web dev:
- `npm install`
- `npm run dev`

iOS build/sync:
- `npm run build`
- `npx cap sync`
- `npx cap open ios`

iOS live reload:
- `npm run dev -- --host`
- `npx cap run ios --livereload --external`

Commands:
- `npm run build`
- `npx cap add ios`
- `npx cap sync`
- `npx cap open ios`

## Supabase Auth (Email + Password)

Configuration env requise:
- `VITE_SUPABASE_URL` au format strict `https://<ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY`

Checklist Supabase Dashboard:
- `Authentication` > `Providers` > `Email`
- activer `Email` + `Password sign in`
- activer `Confirm email`
- ne plus exposer le flow OTP comme methode principale dans l'UI
- `Authentication` > `URL Configuration`
- `Site URL`: URL de ton app (ex: `http://127.0.0.1:5173` en dev)
- `Redirect URLs`: inclure les URLs de dev/prod autorisees, notamment `/auth/verify-email` et `/auth/reset-password`

Si l'envoi signup/reset affiche `Failed to fetch`:
- Vérifier que le projet Supabase n’est pas en pause
- Vérifier URL/clé dans `.env`
- Désactiver temporairement adblock / privacy shields
- Vérifier que `Confirm email` est bien actif si l'app exige une validation email avant accès

Notes:
- The `ios/` folder is generated locally by Capacitor and is not committed.
- Configure icons/splash in Xcode under `ios/App/App/Assets.xcassets`.
- Configure iOS permission strings in `ios/App/App/Info.plist`.
- StoreKit subscriptions:
  - Configure products in App Store Connect (monthly/yearly IDs).
  - Run `npm run cap:sync` after installing native dependencies.
  - Test with a sandbox Apple ID on device/simulator.

## Supabase + AI readiness

Avant d'activer le backend IA, applique les migrations Supabase du repo sur le projet distant.

- commande de référence: `supabase db push`
- tables minimales requises: `profiles`, `user_data`, `billing_entitlements`, `ai_request_logs`
- doc d'exploitation: [docs/supabase-ai-readiness.md](/Users/allan/Desktop/discip-yourself code/docs/supabase-ai-readiness.md)

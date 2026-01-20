# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

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

Notes:
- The `ios/` folder is generated locally by Capacitor and is not committed.
- Configure icons/splash in Xcode under `ios/App/App/Assets.xcassets`.
- Configure iOS permission strings in `ios/App/App/Info.plist`.
- StoreKit subscriptions:
  - Configure products in App Store Connect (monthly/yearly IDs).
  - Run `npm run cap:sync` after installing native dependencies.
  - Test with a sandbox Apple ID on device/simulator.

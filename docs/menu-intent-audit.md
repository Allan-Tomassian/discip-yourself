# Menu Intent Audit (LOT 11)

- Generated: 2026-02-17T16:16:34.027Z
- Mode: Read-only audit, aucune modification appliquée.

## Wiring actuel des items menu

- **Compte / Profil** (`account`) -> setTab(item.id) via onNavigate -> `/account`
  - `src/components/TopMenuPopover.jsx:6` — const MENU_ITEMS = [
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:133` — else if (t === "account") nextPath = "/account";
- **Réglages** (`preferences`) -> setTab(item.id) via onNavigate -> `/preferences`
  - `src/components/TopMenuPopover.jsx:7` — { id: "account", label: "Compte / Profil", subtitle: "Username, nom, avatar", group: "main" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:134` — else if (t === "preferences") nextPath = "/preferences";
- **Abonnement** (`subscription`) -> setTab(item.id) via onNavigate -> `/subscription`
  - `src/components/TopMenuPopover.jsx:8` — { id: "preferences", label: "Réglages", subtitle: "App / apparence", group: "main" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:135` — else if (t === "subscription") nextPath = "/subscription";
- **Données** (`data`) -> setTab(item.id) via onNavigate -> `/data`
  - `src/components/TopMenuPopover.jsx:9` — { id: "subscription", label: "Abonnement", subtitle: "Statut et options Premium", group: "main" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:136` — else if (t === "data") nextPath = "/data";
- **Confidentialité** (`privacy`) -> setTab(item.id) via onNavigate -> `/privacy`
  - `src/components/TopMenuPopover.jsx:10` — { id: "data", label: "Données", subtitle: "Exporter / importer", group: "main" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:137` — else if (t === "privacy") nextPath = "/privacy";
- **Conditions** (`terms`) -> setTab(item.id) via onNavigate -> `/terms`
  - `src/components/TopMenuPopover.jsx:11` — { id: "privacy", label: "Confidentialité", subtitle: "Politique de données", group: "secondary" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:138` — else if (t === "terms") nextPath = "/terms";
- **Support** (`support`) -> setTab(item.id) via onNavigate -> `/support`
  - `src/components/TopMenuPopover.jsx:12` — { id: "terms", label: "Conditions", subtitle: "Conditions d'utilisation", group: "secondary" },
  - `src/components/TopMenuPopover.jsx:36` — if (typeof onNavigate === "function") onNavigate(itemId);
  - `src/App.jsx:250` — onMenuNavigate={(action) => {
  - `src/hooks/useAppNavigation.js:139` — else if (t === "support") nextPath = "/support";

## Navigation vs menu in-place

- Constat: le menu déclenche actuellement un flux navigation (`TopMenuPopover` -> `onNavigate(itemId)` -> `App.setTab(action)` -> `history.pushState`).
- Ce wiring est incompatible avec un menu 100% in-place tant qu’il n’est pas remplacé par un state interne de vue.

## Impact suppression/présence des pages

- `src/pages/Account.jsx`: présent
- `src/pages/Preferences.jsx`: présent
- `src/pages/Subscription.jsx`: présent
- `src/pages/Data.jsx`: présent
- `src/pages/Privacy.jsx`: présent
- `src/pages/Terms.jsx`: présent
- `src/pages/Support.jsx`: présent
- `src/pages/Settings.jsx`: absent

- Conclusion: les pages cibles principales existent. Le problème d’invisibilité est probablement lié au layout/stacking, pas à l’absence des routes/pages.

## Plan in-place menu (non implémenté)

- State proposé: `menuView = 'root' | 'account' | 'preferences' | 'subscription' | 'data' | 'privacy' | 'terms' | 'support'`
- Menu items ne déclenchent plus setTab/history mais setMenuView(...)
- Back interne (retour sous-vue -> root) dans la même card
- Close/ESC/click-outside conserve la fermeture globale
- Option future: deep-link facultatif (opt-in) sans forcer navigation par défaut

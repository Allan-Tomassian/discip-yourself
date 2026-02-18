# Totem Dock Audit (Read-only)

## Scope
- `src/components/TopNav.jsx`
- `src/components/TopMenuPopover.jsx`
- `src/components/CategoryRail.jsx`
- `src/App.jsx`
- `src/index.css`
- `src/shared/ui/gate/Gate.jsx`
- `src/shared/ui/gate/gate.css`
- `src/shared/ui/gate/gate-premium.css`
- `src/features/navigation/topMenuGate.css`
- `src/features/navigation/bottomCategoryBar.css`
- Overlay/portal dependencies: `src/components/UI.jsx`, `src/shared/ui/overlays/overlays.css`, `src/components/PaywallModal.jsx`, `src/ui/today/RewardedAdModal.jsx`, `src/ui/today/TotemAnimationOverlay.jsx`, `src/components/EditItemPanel.jsx`, `src/components/PlusExpander.jsx`, `src/ui/portal/Portal.jsx`

## 1) Overlays / Portals Inventory (file:line + z-index)

| Layer | Mount strategy | File refs | Z-index source |
|---|---|---|---|
| Top menu scrim | `createPortal(..., document.body)` | `src/components/TopNav.jsx:198-205` | `1200` (`Z_INDEX.scrim`) + `.topMenuScrim` fallback `var(--z-scrim, 1200)` in `src/features/navigation/topMenuGate.css:112-117` |
| Top menu popover | `createPortal(..., document.body)` | `src/components/TopNav.jsx:206-226` | `1210` (`Z_INDEX.popover`) + `.topMenuPopoverLayer` fallback `var(--z-popover, 1210)` in `src/features/navigation/topMenuGate.css:119-125` |
| Paywall modal | `createPortal(content, document.body)` | `src/components/PaywallModal.jsx:149` | `.paywallBackdrop { z-index: 10000 }` `src/features/paywall/paywall.css:1-3`; panel `10001` at `src/features/paywall/paywall.css:16-19` |
| Rewarded ad modal | `createPortal(..., document.body)` | `src/ui/today/RewardedAdModal.jsx:55-114` | `.microAdBackdrop { z-index: var(--z-modal, 2000) }` in `src/features/today/today.css:346-354` |
| Totem animation overlay | `createPortal(..., document.body)` | `src/ui/today/TotemAnimationOverlay.jsx:27-41` | `.totemAnimOverlay { z-index: calc(var(--z-toast, 3000) - 20) }` in `src/features/today/today.css:389-394` |
| Edit drawer | `createPortal(overlay, document.body)` | `src/components/EditItemPanel.jsx:621` | backdrop uses `.modalBackdrop` (`--z-modal`) from `src/shared/ui/overlays/overlays.css:1-5` |
| Plus expander | `<Portal>` (custom root in body) | `src/components/PlusExpander.jsx:92-117`, root in `src/ui/portal/Portal.jsx:4-15` | `.plusExpander { z-index: var(--z-dropdown) }` in `src/index.css:1300-1303` |
| Select dropdowns | `<Portal>` (custom root in body) | `src/ui/select/Select.jsx:342-389` | `Z.dropdown` or `Z.modal + 1` from `src/ui/select/Select.jsx:75-77`, `:174-177`, `:357`; scale in `src/ui/layer/zIndex.js:1-6` |
| Datepicker dropdowns | `<Portal>` (custom root in body) | `src/ui/date/DatePicker.jsx:256-360` | same strategy as Select (`Z.dropdown` / `Z.modal + 1`) |
| Generic Modal overlays (CategoryGate/CreateFlow/etc) | **not portalized** (`div.modalBackdrop` rendered inline) | `src/components/UI.jsx:225-257`, used by `src/components/CategoryGateModal.jsx:150-155`, `src/ui/create/CreateFlowModal.jsx:128-133` | `.modalBackdrop { z-index: var(--z-modal) }` in `src/shared/ui/overlays/overlays.css:1-5` |
| Reminder / discipline sheets in Home | inline `.modalBackdrop` | `src/App.jsx:917-1021`, `src/pages/Home.jsx:2148-2259` | `.modalBackdrop` (`--z-modal`) |
| Bottom category bar | fixed in app tree | `src/App.jsx:573-605` | `.bottomCategoryBar { z-index: 46 }` in `src/features/navigation/bottomCategoryBar.css:1-7` |

Global z-scale tokens are defined in `src/index.css:27-36`:
- `--z-topbar: 900`
- `--z-scrim: 1200`
- `--z-popover: 1210`
- `--z-modal: 2000`
- `--z-toast: 3000`

## 2) Clipping / Stacking Risks

1. `GateGlassClip` creates a clipping/stacking context:
   - `overflow: hidden` + `transform: translateZ(0)` in `src/shared/ui/gate/gate-premium.css:9-17`.
   - Risk: any future `position: fixed` descendant inside this subtree can get clipped or mis-positioned on iOS Safari.
   - Mitigation for Totem Dock: render dock layer via portal at `document.body` (or dedicated body portal root), not inside topbar/bottom bar clip wrappers.

2. iOS overrides can alter overlay positioning:
   - `.ios .modalBackdrop { position: absolute; }` in `src/shared/ui/overlays/overlays.css:39-40`.
   - `.ios .drawerPanelOuter { position: absolute; }` in `src/index.css:1426-1428`.
   - Risk: unexpected anchor behavior if a new fixed dock is nested inside modal/drawer subtrees.

3. Multiple high-priority overlays coexist:
   - Top menu: 1200/1210.
   - Modals: 2000.
   - Totem animation: ~2980.
   - Paywall: 10000+ (hard override outside token scale).
   - Recommendation: Totem Dock base must remain under modal/paywall by default (e.g. between topbar and scrim), and panel can elevate to popover tier when opened.

4. Portal root strategy is already mixed:
   - Direct `document.body` portals (TopNav menu, paywall, rewarded modal, totem overlay, edit drawer).
   - Custom portal root `#app-portal-root` from `Portal.jsx` for PlusExpander/Select/DatePicker.
   - Recommendation: choose one explicit dock mounting strategy and keep it stable (prefer direct `document.body` with deterministic z-index constants for dock).

## 3) iOS Safari Safe-area and Collision Notes

- Safe-area CSS vars are already global in `src/index.css:6-9` and reused across layout.
- Full-bleed viewport config exists in `index.html:6` (`viewport-fit=cover`).
- `TopNav` placement logic already reads safe vars and `visualViewport` in `src/components/TopNav.jsx:45-71`.
- Bottom rail currently consumes bottom safe-area in `src/features/navigation/bottomCategoryBar.css:5`.
- Keyboard-open state hides bottom rail via `.keyboardOpen .bottomCategoryBar` in `src/index.css:1334-1337`.
- Totem Dock must avoid collision with the bottom rail and keyboard states by using safe-area offsets and its own vertical docking slot.

## 4) Best Injection Point for a Global Totem Dock

### Recommended injection: `App.jsx` root layer (single mount), rendered through portal

Why:
- `App.jsx` already orchestrates global fixed UI (`TopNav`, bottom rail, modals) and has cross-tab visibility (`src/App.jsx:569+`).
- Dock should be independent from topbar clipping wrappers (`TopNavSurfaceClip`), and independent from page scroll.
- Mounting in `TopNav` couples Dock to header layout and conflicts with the target of making topbar “navigation-only”.

Practical target location:
- Add `TotemDockLayer` as a sibling to existing global overlays in `App.jsx` root return, and have that component portal to `document.body`.

## 5) Persistence Recommendation (Totem + Dock prefs)

Existing identity/customization model:
- `data.ui.totemV1` normalized by `ensureTotemV1` in `src/logic/totemV1.js:58-98`
- Current fields: `equipped`, `owned`, `lastAnimationAt`, `animationEnabled`.

Recommendation:
- Keep identity/inventory in `totemV1`.
- Add **separate** `data.ui.totemDockV1` for pure dock UI state (placement/panel/visibility), to avoid mixing persistent identity with volatile layout.

Suggested `totemDockV1` scope (UI state only):
- `version`
- `visible` (bool)
- `collapsed` (bool)
- `side` (`"right"` fixed for now)
- `offsetY` (number)
- `panelOpen` (bool)
- `panelView` (`"wallet" | "shop" | "customize" | "behaviors"`)
- `lastOpenedAt` (timestamp)

Fallback option:
- If minimizing schema count is preferred, nest as `totemV1.dock`, but this increases coupling between avatar domain and layout domain.

## 6) Gate Premium Tokens / Classes to Reuse

Use only existing Gate primitives/tokens:
- Glass pattern:
  - `.GateGlassOuter` (`src/shared/ui/gate/gate-premium.css:1-7`)
  - `.GateGlassClip` (`src/shared/ui/gate/gate-premium.css:9-17`)
  - `.GateGlassBackdrop` (`src/shared/ui/gate/gate-premium.css:19-28`)
  - `.GateGlassContent` (`src/shared/ui/gate/gate-premium.css:30-33`)
- Surface tokens:
  - `.GateSurfacePremium` (`src/shared/ui/gate/gate-premium.css:40-53`)
  - `.GateCardPremium` (`src/shared/ui/gate/gate-premium.css:65-70`)
- Interaction:
  - `.GatePressable` rules (`src/shared/ui/gate/gate-premium.css:188-209`)

For topbar simplification target:
- Keep topbar as nav-only shell using existing topbar wrappers (`src/components/TopNav.jsx:239-242`) and remove wallet/totem identity concerns from this layer in implementation phase.

## 7) Architecture Mapping (minimal, no code)

- `TotemDockLayer`
  - Responsibility: global fixed dock host, mounted once, body-portalized, safe-area aware.
  - Contains button + panel container + outside click management.
  - Z-index tier: above content/topbar, below modal/paywall by default.

- `TotemDockButton`
  - Responsibility: persistent right-edge anchor (branch + eagle icon), compact touch target.
  - States: idle, active, collapsed/expanded.
  - Opens `TotemDockPanel` in-place (no route navigation).

- `TotemDockPanel`
  - Responsibility: in-place subviews (`wallet`, `shop`, `customize`, `behaviors`) with internal view stack.
  - Uses Gate panel + glass clip pattern.
  - Scrollable content with constrained height (`100dvh` minus safe areas and margins).

## 8) Final Verdict

- Current architecture is **compatible** with a fixed global Totem Dock, provided it is portalized and isolated from existing clip/transform wrappers.
- Main implementation risks are stacking tier conflicts (especially paywall and modal tiers) and iOS absolute/fixed behavior in legacy modal contexts.

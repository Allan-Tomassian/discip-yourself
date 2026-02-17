# Hamburger Layer Audit (LOT 11)

- Generated: 2026-02-17T16:18:01.850Z
- Data source: `docs/hamburger-layer-map.json`
- Mode: Read-only static audit (aucun correctif appliqué).

## Commandes exécutées

- `node scripts/hamburger-layer-audit.mjs && node scripts/hamburger-layer-report.mjs`
- `node scripts/menu-intent-audit.mjs`
- `node scripts/ui-uniformity-scan.mjs && node scripts/ui-uniformity-report.mjs`
- `node scripts/text-audit-scan.mjs && node scripts/text-audit-report.mjs`

## Stacking map (synthèse)

- Topbar layers: `.stickyStack`, `.topNavGateWrap`, `.topNavGateBar`.
- Overlay scrim: `.topMenuScrim`.
- Popover: `.topMenuPopoverLayer` -> `.topMenuGatePopover` -> `.topMenuGate`.
- Glass clipping primitives: `.GateGlassOuter` + `.GateGlassClip` + `.GateGlassBackdrop`.

## Causes probables (triées)

### 1. Topbar z-index au-dessus du popover (high)

- Pourquoi: Quand le menu est ouvert, la topbar passe à 1011 alors que le popover est à 1010. Cela peut masquer ou recouvrir la card du menu.
- Preuves:
- `src/components/TopNav.jsx:153` — style={{ zIndex: menuOpen ? 1011 : 900 }}
- `src/components/TopNav.jsx:153` — style={{ zIndex: menuOpen ? 1011 : 900 }}
- `src/components/TopNav.jsx:199` — zIndex: 1010,
- `src/components/TopNav.jsx:199` — zIndex: 1010,

### 2. Popover fixed potentiellement contraint par un ancêtre clip/transformed (critical)

- Pourquoi: Le menu est rendu dans un arbre contenant `GateGlassClip` (`overflow:hidden` + `transform`). Sur Safari/iOS cela peut créer un containing block et clipper/masquer un descendant `position: fixed`.
- Preuves:
- `src/components/TopNav.jsx:156` — <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
- `src/components/TopNav.jsx:196` — className="topMenuPopoverLayer"
- `src/shared/ui/gate/gate-premium.css:9` — .GateGlassClip {
- `src/shared/ui/gate/gate-premium.css:14` — backface-visibility: hidden;

### 3. Clamp horizontal sans garde maxLeft>=minLeft (medium)

- Pourquoi: Si la viewport reportée est anormale (iOS visualViewport transient), `maxLeft` peut passer sous `minLeft` et pousser la card hors écran.
- Preuves:
- `src/components/TopNav.jsx:38` — const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
- `src/components/TopNav.jsx:39` — const safeBottom = Number.parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
- `src/components/TopNav.jsx:46` — const maxWidth = Math.min(560, Math.max(260, vw - 24));
- `src/components/TopNav.jsx:49` — const left = clamp(desiredLeft, minLeft, maxLeft);
- `src/components/TopNav.jsx:50` — const top = Math.max(desiredTop, 12 + safeTop);

## Top suspects selectors/classes

- `.topMenuPopoverLayer` (8 occurrences)
- `.GateGlassClip` (6 occurrences)
- `.stickyStack` (6 occurrences)
- `/* Backdrop blur is scoped to GateGlass wrappers to avoid iOS clipping artifacts. */

.bgImg` (5 occurrences)
- `.GateGlassBackdrop::before` (4 occurrences)
- `.topMenuPopoverLayer > *` (3 occurrences)
- `.topNavGateBar` (3 occurrences)
- `.GateGlassContent` (2 occurrences)
- `.GateGlassOuter` (2 occurrences)
- `.topMenuScrim` (2 occurrences)
- `.topNavGateBar .navMenuBars span` (2 occurrences)
- `.topNavGateWrap` (2 occurrences)

## iPhone / safe-area / clip observations

- `src/App.jsx:159` — if (typeof window === "undefined" || !window.visualViewport) return undefined;
- `src/App.jsx:162` — const vv = window.visualViewport;
- `src/App.jsx:169` — window.visualViewport.addEventListener("resize", updateKeyboardClass);
- `src/App.jsx:170` — window.visualViewport.addEventListener("scroll", updateKeyboardClass);
- `src/App.jsx:172` — window.visualViewport?.removeEventListener("resize", updateKeyboardClass);
- `src/App.jsx:173` — window.visualViewport?.removeEventListener("scroll", updateKeyboardClass);
- `src/components/PlusExpander.jsx:64` — const vv = window.visualViewport;
- `src/components/PlusExpander.jsx:71` — const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
- `src/components/TopNav.jsx:26` — const [menuLayout, setMenuLayout] = useState({ top: 72, left: 180, width: 336, maxHeight: 420 });
- `src/components/TopNav.jsx:34` — const vv = window.visualViewport;
- `src/components/TopNav.jsx:38` — const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
- `src/components/TopNav.jsx:39` — const safeBottom = Number.parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
- `src/components/TopNav.jsx:127` — window.visualViewport?.addEventListener("resize", update);
- `src/components/TopNav.jsx:128` — window.visualViewport?.addEventListener("scroll", update);
- `src/components/TopNav.jsx:133` — window.visualViewport?.removeEventListener("resize", update);
- `src/components/TopNav.jsx:134` — window.visualViewport?.removeEventListener("scroll", update);
- `src/features/navigation/topMenuGate.css:115` — 
- `src/features/navigation/topMenuGate.css:116` — .topMenuPopoverLayer {
- `src/features/navigation/topMenuGate.css:117` — --safeTop: env(safe-area-inset-top, 0px);
- `src/features/navigation/topMenuGate.css:118` — --safeBottom: env(safe-area-inset-bottom, 0px);

## Portals

- `src/components/EditItemPanel.jsx:2` — import { createPortal } from "react-dom";
- `src/components/EditItemPanel.jsx:621` — return createPortal(overlay, document.body);
- `src/components/PaywallModal.jsx:2` — import { createPortal } from "react-dom";
- `src/components/PaywallModal.jsx:149` — return createPortal(content, document.body);

## Runtime checklist (DevTools, non appliqué)

1. Cliquer hamburger puis vérifier `menuOpen` passe à `true` (React DevTools).
2. Vérifier présence DOM de `.topMenuPopoverLayer` et dimensions calculées (`top`, `left`, `width`, `--topMenuMaxH`).
3. Vérifier computed styles du popover: `opacity`, `visibility`, `pointer-events`, `z-index`.
4. Vérifier ancêtres: presence de `.GateGlassClip` avec `overflow:hidden` et `transform` actif.
5. Vérifier si la topbar couvre la zone popover (`z-index` topbar > popover).
6. Sur iPhone, vérifier `visualViewport` au moment du clic et la valeur calculée `left`/`maxHeight`.

## Conclusion audit

- Diagnostic principal: conflit de stacking + clipping de conteneur glass autour d’un popover fixed (suspect critique).
- Diagnostic secondaire: topbar ouverte à un z-index supérieur au popover.
- Diagnostic tertiaire: edge case de calcul clamp horizontal quand viewport reportée est transitoire.

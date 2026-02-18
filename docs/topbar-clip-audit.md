# Clip/Backdrop Audit (Topbar + Menu)

Date: 2026-02-17
Mode: audit-only

## Verdict
✅ **Conforme sur le clipping principal** (topbar et card menu)

Le pattern `Outer + Clip + Backdrop` est appliqué sur la topbar et la card du popover. Le popover est rendu en portal, donc non clipé par la topbar.

## Inventaire backdrop-filter (périmètre topbar/menu)

1. `src/shared/ui/gate/gate-premium.css`
- `.GateGlassBackdrop::before` (blur générique Gate)
- `.GateOverlayBackdrop` (classe overlay utilitaire)

2. `src/features/navigation/topMenuGate.css`
- `.topMenuCardClip` applique `backdrop-filter: blur(12px) saturate(1.08)`

3. Scrim fullscreen
- `.topMenuScrim` n'applique **pas** de blur (dim-only).

Extrait (`src/features/navigation/topMenuGate.css:109-147`):
```css
.topMenuScrim {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.28);
}

.topMenuCardClip {
  position: relative;
  border-radius: inherit;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border-subtle, var(--border)) 90%, rgba(255, 255, 255, 0.2));
  background: color-mix(in srgb, #0b111b 54%, transparent);
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
}
```

## Vérification du clip par surface

### A) Topbar
- Outer: `.TopNavSurfaceOuter.GateGlassOuter` (shadow + radius)
- Clip: `.TopNavSurfaceClip.GateGlassClip` (`overflow: hidden`, `border-radius: inherit`)
- Backdrop: `.TopNavBackdrop.GateGlassBackdrop::before`
- Content: `GatePanel.topNavGateBar.GateGlassContent`

Extrait (`src/components/TopNav.jsx:218-221`):
```jsx
<div className="TopNavSurfaceOuter GateGlassOuter">
  <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
    <GatePanel className="topNavGateBar GateGlassContent" data-tour-id="topnav-row">
```

Résultat: clip correct, pas de bleed carré détectable statiquement.

### B) Popover menu
- Outer: `.topMenuCardOuter` (shadow)
- Clip: `.topMenuCardClip` (`overflow: hidden`, `border-radius: inherit`)
- Backdrop: blur sur `.topMenuCardClip`
- Content: `.topMenuCardContent` (scroll interne)

Extrait (`src/components/TopMenuPopover.jsx:141-147`):
```jsx
<div className="topMenuGatePopover">
  <div className="topMenuCardOuter">
    <div className="topMenuCardClip">
      <GatePanel
        className="topMenuGate topMenuCardContent"
        role={inSubview ? "dialog" : "menu"}
```

Résultat: clip correct, blur limité à la card.

## Détection du pattern à risque Safari iOS

Pattern à risque: `overflow:hidden + transform + descendant fixed` dans le même subtree.

- `GateGlassClip` inclut `transform: translateZ(0)` (`src/shared/ui/gate/gate-premium.css:16`).
- Le popover `fixed` est rendu via portal (`document.body`) dans `TopNav.jsx:173-208`.

Conclusion:
- ✅ Risque évité pour le menu (pas de descendant fixed sous `.GateGlassClip` topbar).
- ⚠️ À surveiller ailleurs: toute future overlay non portaled sous `.GateGlassClip` serait exposée.

## Scrim vs card clip

- Scrim fullscreen: dim-only, sans blur (`topMenuScrim`).
- Card menu: blur clipé dans `.topMenuCardClip`.
- Séparation claire des responsabilités visuelles.

## Plan de Fix Minimal (non appliqué)

1. Garder le blur card-only dans `topMenuCardClip` (ne pas le déplacer sur scrim).
2. Conserver le portal `document.body` pour tout overlay menu fixed.
3. Ajouter commentaire CSS sur `.topMenuCardClip` indiquant que c'est la seule couche blur du menu.
4. Ajouter check visuel iOS en QA: coins arrondis + absence de bleed au scroll.

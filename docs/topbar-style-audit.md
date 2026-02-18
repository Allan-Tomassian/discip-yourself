# Topbar Style Conformity Report

Date: 2026-02-17
Mode: audit-only (read-only sur `src/**`)

## Verdict
⚠️ **Partiellement conforme**

La topbar suit bien les primitives Gate et le pattern clip glass, mais elle n'est pas strictement alignée sur la signature visuelle des cards premium (`GateSurfacePremium` + `GateCardPremium`) utilisée dans Subscription/Data/Support.

## Surface Topbar Actuelle

Composants/classes réellement utilisés:
- `TopNav.jsx` rend `GatePanel` dans `TopNavSurfaceOuter/GateGlassOuter` + `TopNavSurfaceClip/GateGlassClip/GateGlassBackdrop`.
- Surface de topbar: `GatePanel.topNavGateBar.GateGlassContent`.

Extrait (`src/components/TopNav.jsx:218-227`):
```jsx
<div className="TopNavSurfaceOuter GateGlassOuter">
  <div className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop">
    <GatePanel className="topNavGateBar GateGlassContent" data-tour-id="topnav-row">
      <div ref={topbarRef} className="navRow">
        <div className="navGrid" data-tour-id="topnav-tabs">
          {NAV_ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setActive(it.id)}
```

## Équivalent Attendu (Référence Card Premium)

Référence pages premium (Subscription/Data/Support):
- `GateSection` avec `className="GateSurfacePremium GateCardPremium"`
- Titres via `GatePageTitle`/`GatePageSubtitle`

Extrait (`src/pages/Subscription.jsx:27-33`):
```jsx
<GateSection
  title={premium ? "Premium actif" : "Version gratuite"}
  description="Gère ton plan et tes achats."
  collapsible={false}
  className="GateSurfacePremium GateCardPremium"
>
```

## Divergences Relevées

1. **Classes premium non appliquées directement à la topbar**
- Topbar: `topNavGateBar` custom.
- Référence: `GateSurfacePremium GateCardPremium`.
- Impact: risque d'écart de rendu lors d'évolution des tokens premium.
- Preuve: `src/components/TopNav.jsx:220`, `src/features/navigation/topMenuGate.css:28-44`, `src/shared/ui/gate/gate-premium.css:40-64`.

2. **Gradient/opacité différents de la card premium**
- Topbar: gradient via `color-mix(..., transparent)`.
- Premium: gradient opaque à partir de `--gate-surface-1/2`.
- Preuve:
  - Topbar `src/features/navigation/topMenuGate.css:34-38`
  - Premium `src/shared/ui/gate/gate-premium.css:46-50`

3. **Densité/padding différent**
- Topbar panel: `padding: 8px`.
- Card premium: `GateCardPremium` -> `padding: 14px`.
- Preuve: `src/features/navigation/topMenuGate.css:40`, `src/shared/ui/gate/gate-premium.css:60-64`.

4. **Interaction topbar hors GatePressable**
- Onglets (`.navBtn`) et bouton hamburger (`.navMenuTrigger`) ne portent pas `.GatePressable`.
- Impact: feedback press non uniformisé avec le reste du système Gate.
- Preuve: `src/components/TopNav.jsx:224-254`.

5. **TopMenu popover partiellement custom**
- Popover suit Gate + clip, mais tokens visuels sont redéfinis localement (`.topMenuGate*`) au lieu d'utiliser seulement classes premium.
- Preuve: `src/features/navigation/topMenuGate.css:158-174`.

## Hover / Active / Press

Extrait (`src/shared/ui/gate/gate-premium.css:182-193`):
```css
.gateButton.GatePressable,
.gateRow.isInteractive.GatePressable {
  transition:
    transform 90ms ease-out,
    box-shadow 90ms ease-out,
    background 120ms ease-out,
    border-color 120ms ease-out;
}

.gateButton.GatePressable:active,
.gateRow.isInteractive.GatePressable:active {
  transform: translateY(1px) scale(0.99);
```

Constat:
- `TopMenuPopover` applique correctement `.GatePressable` sur rows/boutons (`src/components/TopMenuPopover.jsx:189,208,221,256...`).
- Topbar tabs + hamburger n'utilisent pas `.GatePressable`.
- Aucune fuite globale vers calendrier/toggles catégorie (style press reste opt-in).

## Plan de Fix Minimal (non appliqué)

1. Appliquer `GateSurfacePremium GateCardPremium` sur la surface topbar (`TopNav`) et limiter `topNavGateBar` aux ajustements layout.
2. Réduire les overrides de gradient/topbar pour utiliser les tokens premium sans `transparent` fort.
3. Ajouter `.GatePressable` au hamburger (et aux onglets si validé UX) pour uniformiser le feedback press.
4. Garder les exceptions calendrier/toggles via absence de `.GatePressable` ou `noPressFx` explicite.
5. Documenter ce contrat dans `topMenuGate.css` (section "topbar surface uses premium tokens").

# Card Style Diff — Topbar vs Gate Premium Reference

Date: 2026-02-17
Mode: audit-only

## Verdict
⚠️ **Partiellement conforme**

La topbar est visuellement proche mais pas strictement identique à la card premium de référence.

## Référence Premium (pages Subscription/Data/Support)

Pattern constaté:
- `GateSection` + `GateSurfacePremium GateCardPremium`
- Tokens définis dans `gate-premium.css`

Extrait (`src/shared/ui/gate/gate-premium.css:40-50`):
```css
.GateSurfacePremium {
  --gate-surface-1: color-mix(in srgb, var(--surface-3, #1b202b) 94%, #070b12);
  --gate-surface-2: color-mix(in srgb, var(--surface-2, #151b24) 92%, #05090f);
  --gate-border: color-mix(in srgb, var(--border-subtle, var(--border)) 91%, rgba(255, 255, 255, 0.2));
  border: 1px solid var(--gate-border);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--gate-surface-1), var(--gate-surface-2));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
```

## Topbar actuelle

Pattern constaté:
- `GatePanel.topNavGateBar` dans wrappers `GateGlass*`
- styles premium re-déclarés localement dans `topMenuGate.css`

Extrait (`src/features/navigation/topMenuGate.css:28-40`):
```css
.topNavGateBar {
  --gate-surface-1: color-mix(in srgb, var(--surface-3, #1b202b) 92%, #090d14);
  --gate-surface-2: color-mix(in srgb, var(--surface-2, #151b24) 90%, #070b11);
  --gate-border: color-mix(in srgb, var(--border-subtle, var(--border)) 92%, rgba(255, 255, 255, 0.18));
  border: 1px solid var(--gate-border);
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--gate-surface-1) 78%, transparent),
```

## Diff détaillé

| Axe | Référence premium | Topbar actuelle | Écart |
|---|---|---|---|
| Classe de surface | `GateSurfacePremium` | `topNavGateBar` custom | Topbar découplée des tokens premium centraux |
| Classe de densité | `GateCardPremium` (`padding:14px`) | `padding:8px` | Densité plus compacte |
| Gradient | Opaque (`surface1 -> surface2`) | `color-mix(..., transparent)` | Transparence plus élevée |
| Border token | `--gate-border` (91%) | `--gate-border` (92% + 0.18 alpha) | Légère divergence |
| Relief | Inset + shadow premium | Inset léger, outer shadow via `GateGlassOuter` | Répartition différente du relief |
| Press feedback | `.GatePressable` attendu sur interactifs | absent sur tabs/hamburger | retour tactile non homogène |

## Cause Principale

Le style premium est bien utilisé dans les pages de référence, mais la topbar et le popover reposent encore sur des overrides locaux (`topMenuGate.css`) qui miment ce style au lieu d'hériter directement de `GateSurfacePremium`/`GateCardPremium`.

## Fix Plan Minimal (non appliqué)

1. Faire porter `GateSurfacePremium GateCardPremium` à la topbar (`GatePanel`) puis garder `topNavGateBar` pour layout seulement.
2. Diminuer/retirer les gradients transparents locaux de topbar/popover pour coller au preset premium.
3. Aligner le padding topbar/popover sur la densité premium (ou documenter explicitement une variante "compacte").
4. Ajouter `.GatePressable` au hamburger (et éventuellement tabs) pour homogénéiser l'interaction.
5. Éviter les redéfinitions de tokens visuels dans `topMenuGate.css` si déjà présents dans `gate-premium.css`.

# Stacking / Z-index Audit (Topbar + Menu)

Date: 2026-02-17
Mode: audit-only

## Verdict
⚠️ **Partiellement conforme**

L'ordre topbar/scrim/popover est cohérent localement, mais l'échelle globale présente des conflits potentiels (modals standards trop bas, collision toast/scrim).

## Z-index Effectifs Relevés

| Layer | Valeur | Source |
|---|---:|---|
| Base background | -2 / -1 | `src/index.css:195`, `src/index.css:232` |
| Bottom category bar | 46 | `src/features/navigation/bottomCategoryBar.css:6` |
| Modal générique | `var(--z-modal)` = 80 | `src/shared/ui/overlays/overlays.css:4`, `src/index.css:31` |
| Topbar | 900 | `src/components/TopNav.jsx:16,216`, `src/features/navigation/topMenuGate.css:8` |
| Scrim menu | 1200 | `src/components/TopNav.jsx:17,178`, `src/features/navigation/topMenuGate.css:112` |
| Popover menu | 1210 | `src/components/TopNav.jsx:18,189`, `src/features/navigation/topMenuGate.css:121` |
| Toast layer | 1200 | `src/index.css:32` |
| Paywall | 10000 / 10001 | `src/features/paywall/paywall.css:2,18` |

Extrait (`src/components/TopNav.jsx:15-19`):
```jsx
const Z_INDEX = {
  topbar: 900,
  scrim: 1200,
  popover: 1210,
};
```

## Risques Concrets

1. **Modals génériques sous la topbar/menu**
- `--z-modal: 80` est très inférieur à la topbar (900) et au menu (1200+).
- Risque: modal "derrière" les couches nav/menu selon l'ordre DOM.

2. **Toast vs scrim collision**
- Toast `1200` = scrim `1200`.
- Risque d'ordre non déterministe selon montage DOM (toast masqué par scrim).

3. **Échelle non unifiée**
- Paywall est isolé à 10000, alors que modal générique reste à 80.
- Complexifie la maintenance du stacking system.

## Recommandations chiffrées (non appliquées)

Ordre recommandé:
- Base content: `0`
- Topbar sticky: `900`
- Scrim menu: `1200`
- Popover menu: `1210`
- Modals/Drawers/Dialogs (génériques): `1300`
- Toasts: `1400`
- Overlays critiques (paywall si conservé séparé): `1500+`

Ajustements minimaux suggérés:
1. Monter `--z-modal` à `1300`.
2. Monter `--z-toast` à `1400`.
3. Conserver `topbar=900`, `scrim=1200`, `popover=1210` (déjà bons pour le menu).
4. Documenter cette hiérarchie dans un seul fichier token (ex: `index.css :root`).

## Vérification “menu derrière/devant topbar”

- Menu popover est en portal (`document.body`) et z-index 1210.
- Topbar est 900.
- Résultat actuel: popover au-dessus de topbar, scrim entre les deux.

# Hamburger Runtime Checklist (DevTools)

## Au clic hamburger
- Vérifier que l’état `menuOpen` passe à `true` (React DevTools).
- Vérifier la présence DOM de `.topMenuPopoverLayer` et `.topMenuGatePopover`.
- Vérifier la présence DOM de `.topMenuScrim`.

## Computed Styles à contrôler
- `.topMenuPopoverLayer`: `display`, `opacity`, `visibility`, `pointer-events`, `position`, `top`, `left`, `z-index`.
- `.topMenuScrim`: `z-index` inférieur au popover.
- Parent topbar: absence de `transform`/`filter` qui crée un stacking context bloquant.

## Interaction
- Clic sur item menu: pas d’interception pointer par scrim.
- Clic outside: fermeture.
- Touche ESC: fermeture.

## Routing / Navigation
- Clic "Réglages" -> tab `preferences` (ou vue interne cible si refactor).
- Vérifier qu’aucune erreur console `no route match` / `undefined tab`.

## Captures utiles si bug
- Capture DOM de `.topMenuPopoverLayer` + styles computed.
- Capture DOM de `.topMenuScrim` + z-index.
- Screenshot overlay montrant topbar/menu/scrim.

# Hamburger Fixes Plan (Non Exécuté)

## A) Repositionnement sous topbar + clamp + safe-area
1. Mesurer la topbar au clic (getBoundingClientRect). 
2. Positionner le layer en fixed sous la topbar avec gap 8-12px.
3. Clamp horizontal + maxHeight = viewport - top - safeBottom.
4. Garder overflow auto interne du popover.

## B) Menu Single Surface
1. Conserver une seule surface GatePanel racine.
2. Sections internes flat (pas de backplate globale).
3. Rows cliquables premium sans card imbriquée inutile.

## C) Mode Menu Interne (sans navigation pages)
1. Introduire un state local `menuView` (profil/réglages/données etc.).
2. Garder callbacks actions sensibles (logout) inchangés.
3. Option: conserver deep-link comme fallback derrière feature flag.

## D) Compat iPhone
1. Safe-area top/bottom sur placement et maxHeight.
2. Pattern Outer/Clip/Backdrop sur la surface du popover.
3. Vérifier qu’aucun parent transform/filter ne casse le stacking fixed.

## E) Suppression pages / routing safety
1. Contrat: chaque item menu doit mapper vers tab valide OU vue interne.
2. Tests statiques: item->tab, tab->path, path->page existante.
3. Garder redirect `/settings` -> `/preferences` tant que legacy links existent.

## Priorité d’exécution
1. Stacking/z-index + visibilité popover.
2. Repositionnement stable sous topbar.
3. Décision produit: navigation tab/history vs menu interne.
4. Durcissement tests e2e ciblés menu.

## Points d’appui (preuves scan)
- Trigger hamburger: `src/components/TopNav.jsx#L184`
- Mount popover: `src/components/TopNav.jsx#L196`
- Items menu source: `src/components/TopMenuPopover.jsx#L6`
- Registry tabs: `unknown`

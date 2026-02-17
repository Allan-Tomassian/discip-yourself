# Hamburger Audit (Read-Only)
Generated: 2026-02-17T16:02:07.191Z

## Conclusion Branch
- Résultat: **3) Menu ouvert mais potentiellement invisible/hors écran/stacking**
- Statut trigger: présent
- Statut popover mount: présent
- Statut handler open: présent

## Preuves (fichiers/ligne)
- TopNav importé dans App: `src/App.jsx#L2`
- TopNav rendu dans App: `src/App.jsx#L227`
- TopMenuPopover monté dans TopNav: `src/components/TopNav.jsx#L210`
- Bouton hamburger: `src/components/TopNav.jsx#L184`
- Toggle onClick: `src/components/TopNav.jsx#L178`
- Condition render open: `src/components/TopNav.jsx#L140`, `src/components/TopNav.jsx#L193`
- Layer popover: `src/components/TopNav.jsx#L196`
- Scrim: `src/components/TopNav.jsx#L142`
- z-index inline scrim/layer: 1000 / 1010
- z-index CSS scrim/layer: 1000 / 1010

## Routing / Pages / Items Impact
- Mode navigation détecté: tab-history
- React Router détecté: non (tab/history interne)
- Items menu: `account`, `preferences`, `subscription`, `data`, `privacy`, `terms`, `support`
- Items absents du registry tabs: aucun
- Pages manquantes sur les cibles menu: aucune
- Redirect /settings -> /preferences: `src/hooks/useAppNavigation.js#L171`

## Top 10 Suspects
- Aucun suspect critique détecté statiquement.

## Analyse Ciblée (question 1→6)
1. Composants montés/importés: oui
2. Hamburger déclenche ouverture: oui
3. Popover rendu quand open=true: oui
4. Invisible/hors écran/CSS: risque principal actuel = stacking + position fixed + clipping parent éventuel
5. Items cassés par suppression pages: non
6. Navigation interne vs pages: mode actuel = setTab/history (pas un menu purement interne sans navigation).

## Recommandation immédiate (non appliquée)
- Si bug reproduit: vérifier d’abord stacking context du parent topbar (z-index dynamique + absence de transform/filter parent). 
- En second: vérifier top/left clamp runtime et max-height interne du popover.
- En parallèle: décider si le menu doit rester navigation tab/history ou devenir un mode interne sans navigation.

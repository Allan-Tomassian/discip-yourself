# UI Uniformity Audit (LOT 10)

- Generated: 2026-02-23T13:29:22.216Z
- Source of truth: `src/shared/ui/gate/Gate.jsx`, `src/shared/ui/gate/gate.css`, `src/shared/ui/gate/gate-premium.css`
- Scope: `src/pages/**`, `src/components/**`, `src/ui/**`, `src/features/**`, overlays, popovers, modals, bars.

## Score global

- Conformité Card Premium: **45%** (Faible)
- Fichiers scannés: 223
- Fichiers "card-relevant": 60
- Gate-only: 27
- Mixed (Gate + legacy): 17
- Legacy-only: 16

## Violations par type

- **legacy-component**: 207
- **legacy-css-selector**: 33
- **legacy-import**: 25
- **legacy-class**: 2

## Top hotspots

1. `src/ui/liquidGlassSurface.css` — legacy=31, gate=0, mixed=no
2. `src/pages/CreateV2Habits.jsx` — legacy=26, gate=6, mixed=yes
3. `src/features/library/CategoryManageInline.jsx` — legacy=22, gate=0, mixed=no
4. `src/pages/EditItem.jsx` — legacy=20, gate=0, mixed=no
5. `src/pages/Session.jsx` — legacy=16, gate=6, mixed=yes
6. `src/components/EditItemPanel.jsx` — legacy=16, gate=6, mixed=yes
7. `src/pages/Onboarding.jsx` — legacy=15, gate=0, mixed=no
8. `src/pages/Categories.jsx` — legacy=13, gate=3, mixed=yes
9. `src/pages/Home.jsx` — legacy=8, gate=8, mixed=yes
10. `src/pages/Pilotage.jsx` — legacy=8, gate=2, mixed=yes
11. `src/pages/CreateV2Outcome.jsx` — legacy=7, gate=3, mixed=yes
12. `src/profile/ProfileSetupScreen.jsx` — legacy=7, gate=0, mixed=no
13. `src/auth/LoginScreen.jsx` — legacy=6, gate=0, mixed=no
14. `src/components/Block.jsx` — legacy=6, gate=0, mixed=no
15. `src/pages/CategoryDetailView.jsx` — legacy=6, gate=0, mixed=no

## Mixed files (priorité haute)

- `src/pages/CreateV2Habits.jsx` (legacy=26, gate=6)
- `src/components/EditItemPanel.jsx` (legacy=16, gate=6)
- `src/pages/Session.jsx` (legacy=16, gate=6)
- `src/pages/Categories.jsx` (legacy=13, gate=3)
- `src/pages/Home.jsx` (legacy=8, gate=8)
- `src/pages/Pilotage.jsx` (legacy=8, gate=2)
- `src/pages/CreateV2Outcome.jsx` (legacy=7, gate=3)
- `src/pages/CreateV2HabitType.jsx` (legacy=5, gate=1)
- `src/components/PlusExpander.jsx` (legacy=4, gate=4)
- `src/pages/CreateV2LinkOutcome.jsx` (legacy=4, gate=3)
- `src/components/CategoryGateModal.jsx` (legacy=3, gate=33)
- `src/pages/CreateV2OutcomeNextAction.jsx` (legacy=3, gate=1)
- `src/pages/CreateV2PickCategory.jsx` (legacy=3, gate=1)
- `src/components/AdvancedDrawer.jsx` (legacy=2, gate=4)
- `src/components/ThemePicker.jsx` (legacy=2, gate=10)
- `src/ui/create/CreateFlowModal.jsx` (legacy=2, gate=25)
- `src/ui/LiquidGlassSurface.jsx` (legacy=2, gate=3)

## Overlay / clip risks

- `src/shared/ui/gate/gate-premium.css:17` — backdrop-filter without clear clip pattern (overflow hidden + radius) in same block
- `src/shared/ui/gate/gate-premium.css:33` — backdrop-filter without clear clip pattern (overflow hidden + radius) in same block

## Occurrences les plus fréquentes

- gate-class: 214
- legacy-component: 207
- gate-component: 157
- legacy-css-selector: 33
- legacy-import: 25
- gate-css-selector: 8
- css-backdrop: 3
- legacy-class: 2

## Plan de correction (non appliqué)

### Lot 1 - Navigation & Overlays

- Objectif: Bloque la majorité des écarts visibles immédiatement (topbar, hamburger, modals, popovers).
- Fichiers cibles:
  - `src/tour/TourOverlay.jsx`
  - `src/components/CategoryGateModal.jsx`
  - `src/ui/create/CreateFlowModal.jsx`
  - `src/components/AdvancedDrawer.jsx`

### Lot 2 - Pages métier

- Objectif: Uniformise l’apparence des écrans complets et supprime les mixes Gate/legacy au niveau route.
- Fichiers cibles:
  - `src/pages/CreateV2Habits.jsx`
  - `src/pages/EditItem.jsx`
  - `src/pages/Session.jsx`
  - `src/pages/Onboarding.jsx`
  - `src/pages/Categories.jsx`
  - `src/pages/Home.jsx`
  - `src/pages/Pilotage.jsx`
  - `src/pages/CreateV2Outcome.jsx`
  - `src/pages/CategoryDetailView.jsx`
  - `src/pages/CreateV2HabitType.jsx`
  - `src/pages/CategoryProgress.jsx`
  - `src/pages/SessionMVP.jsx`

### Lot 3 - Composants internes

- Objectif: Évite la réintroduction de styles divergents via composants partagés non migrés.
- Fichiers cibles:
  - `src/ui/liquidGlassSurface.css`
  - `src/features/library/CategoryManageInline.jsx`
  - `src/components/EditItemPanel.jsx`
  - `src/components/Block.jsx`
  - `src/ui/scheduling/ConflictResolver.jsx`
  - `src/components/PlusExpander.jsx`
  - `src/components/ErrorBoundary.jsx`
  - `src/components/CategoryGateModal.jsx`
  - `src/ui/create/CreateFlowModal.jsx`
  - `src/components/ThemePicker.jsx`
  - `src/components/AdvancedDrawer.jsx`
  - `src/ui/LiquidGlassSurface.jsx`

## Traçabilité

- Données brutes: `docs/ui-uniformity-map.json`
- Rapport généré: `docs/ui-uniformity-audit.md`

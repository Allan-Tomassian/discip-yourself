# Progression Refactor Plan

Objectif: converger vers un modèle unique de progression (logique + wording) sans ambiguïté entre Home, Pilotage, Reporting, Bibliothèque et micro-actions.

## Principes

- Une seule source de vérité pour les formules (`expected/done/missed/canceled`, discipline, trend, radar inputs).
- Zéro recalcul métier dans les pages: les pages consomment des sélecteurs/model outputs.
- Glossaire fixe et partagé (`fait / attendu`, `manquées`, `annulées`, `discipline`).
- Tests de contrat sur chaque statut occurrence.

## Lot 0 — Contrat métrique minimal (safe)

But: figer la sémantique avant refactor.

Actions:
1. Spécifier un contrat explicite pour `expected`.
2. Ajouter des tests de contrat croisés (metrics/pilotage/radar/reporting).
3. Documenter le glossaire copy dans un fichier unique.

Fichiers cibles:
- `src/logic/metrics.test.js`
- `src/logic/reporting.test.js`
- nouveau doc métier (ex: `docs/progression-contract.md`)

Critère de sortie:
- Tous les calculs passent sur le même jeu de fixtures statuts.

## Lot 1 — Extraire un modèle unique

But: centraliser les calculs utilisés en UI.

Actions:
1. Créer un module unique (ex: `src/logic/progressionModel.js`) avec:
   - `getTodayProgress(state, dateKey)`
   - `getDisciplineWindow(state, window)`
   - `getPilotageSummary(state, window)`
   - `getCategoryWeeklyStats(state, categoryId, window)`
2. Brancher `Home` et `Pilotage` sur ce module, sans changer l’UI.

Fichiers impactés:
- `src/pages/Home.jsx`
- `src/pages/Pilotage.jsx`
- `src/features/pilotage/radarModel.js`
- `src/features/library/CategoryManageInline.jsx`

Critère de sortie:
- Plus de formules dupliquées `done/expected` dans les pages.

## Lot 2 — Brancher micro-actions proprement

But: rendre explicite la relation micro-actions ↔ progression.

Actions:
1. Décider le modèle:
   - option A: KPI séparé (engagement)
   - option B: pondération explicite dans le score discipline
2. Ajouter un output clair dans le modèle central (`microEngagementScore` ou contribution pondérée).
3. Harmoniser Home/Pilotage avec ce choix.

Fichiers impactés:
- `src/pages/Home.jsx`
- `src/pages/Pilotage.jsx`
- `src/ui/today/MicroActionsCard.jsx` (uniquement exposition/consommation)

Critère de sortie:
- Plus de zone grise “visible mais non compté” dans le score affiché.

## Lot 3 — Normaliser wording + composants de jauge

But: clarté utilisateur stable.

Actions:
1. Uniformiser “fait / attendu” partout.
2. Aligner labels de cards/modals Home/Pilotage/Reporting.
3. Regrouper les composants visuels de progression (`Gauge`, `Meter`, barres inline) dans 1 set cohérent.

Fichiers impactés:
- `src/pages/Home.jsx`
- `src/pages/Pilotage.jsx`
- `src/components/Gauge.jsx`
- CSS associés

Critère de sortie:
- Aucun libellé contradictoire dans l’app.

## Lot 4 — Cleanup + suppression logique orpheline

But: réduire le drift futur.

Actions:
1. Vérifier les fonctions pilotage non branchées:
   - `getLoadSummary`
   - `getDisciplineSummary`
   - `getCategoryWeekBreakdown`
   - `getDisciplineStreak7d`
2. Soit les intégrer au modèle central, soit les supprimer.
3. Ajouter un audit script léger anti-duplication métrique.

Critère de sortie:
- aucune formule métier importante non utilisée.

## Plan de tests recommandé

1. Unit tests:
- statuts occurrences (`planned/done/missed/canceled/skipped/rescheduled/in_progress`)
- micro-actions (limite 3/jour, impact score choisi)
- fenêtres (today/7d/14d/30d/90d)

2. Integration tests:
- Home ↔ Pilotage affichent les mêmes valeurs pour un même dataset.
- Reporting totals alignés avec Pilotage.

3. E2E smoke:
- exécuter action -> progression Home bouge -> Pilotage cohérent -> export reporting cohérent.

## Risques

- Migration partielle = doubles formules temporaires.
- Changement sémantique `expected` peut surprendre les users existants.
- Données legacy (`checks`, `sessions`) peuvent créer des écarts si normalisation incomplète.

Mitigation:
- Feature flag de calcul (old/new) sur une phase courte.
- Snapshot dataset de référence avant/après.


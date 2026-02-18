# Progression Audit

- Généré le: 2026-02-17T23:41:07.090Z
- Scope: src/**
- Fichiers scannés: 204
- Métriques indexées: 17

## Metrics détectées

| Métrique | Calcul (source) | Entrées | Affichage | Fréquence |
|---|---|---|---|---|
| computeCategoryRadarRows | `src/features/pilotage/radarModel.js:41` | computeStats by category, computeDailyStats by category +1 | `src/features/pilotage/radarModel.js:41`, `src/pages/Pilotage.jsx:16` | Pilotage radar selection/window changes |
| computeDailyStats | `src/logic/metrics.js:143` | occurrences[] in [from,to], filters.categoryId +1 | `src/features/pilotage/radarModel.js:50` | recompute when window/filter changes |
| computeDisciplineScore | `src/logic/pilotage.js:51` | occurrences[].status, occurrences[].date +1 | `src/pages/Home.jsx:23`, `src/pages/Home.jsx:851` | Home disciplineBreakdown useMemo |
| computeDisciplineScoreWindow | `src/logic/pilotage.js:77` | occurrences[].status, windowKeys +1 | — | pilotage summary windows |
| computeGoalStats | `src/logic/metrics.js:172` | occurrences[], window +1 | `src/features/pilotage/radarModel.js:66` | report/radar computation |
| computePilotageInsights | `src/features/pilotage/radarModel.js:92` | occurrences + goal/category mapping + time buckets | `src/features/pilotage/radarModel.js:92`, `src/pages/Pilotage.jsx:16` | Pilotage radar window changes |
| computeStats | `src/logic/metrics.js:135` | occurrences[].status, occurrences[].pointsAwarded | — | recompute in useMemo / report generation |
| computeStreakDays | `src/logic/habits.js:78` | computeGlobalAvgForDay | — | reward check invocation |
| coreProgress | `src/pages/Home.jsx:833` | activeHabits, doneHabitIds +1 | `src/pages/Home.jsx:833`, `src/pages/Home.jsx:1439` | Home render/memo on selected date |
| disciplineBreakdown | `src/pages/Home.jsx:849` | computeDisciplineScore, microChecks 14j +1 | `src/pages/Home.jsx:849`, `src/pages/Home.jsx:1474` | Home render/memo |
| getCategoryStatus | `src/logic/pilotage.js:163` | goals by category, occurrences status/date | `src/pages/Pilotage.jsx:5` | Pilotage category list |
| getDisciplineStreak7d | `src/logic/pilotage.js:453` | process goals, past week occurrences | — | utility (currently not wired in page) |
| getDisciplineSummary | `src/logic/pilotage.js:284` | process goals, occurrences statuses | — | utility (currently not wired in page) |
| getLoadSummary | `src/logic/pilotage.js:233` | process goals, occurrences statuses | — | utility (currently not wired in page) |
| getMicroActionsForToday | `src/core/microActions/microActionsEngine.js:118` | categoryId/name, hourNow +3 | `src/ui/today/MicroActionsCard.jsx:3` | MicroActionsCard per category/30min bucket/refresh |
| habitWeekStats | `src/features/library/CategoryManageInline.jsx:90` | process goals in category, occurrences this week | `src/features/library/CategoryManageInline.jsx:90`, `src/features/library/CategoryManageInline.jsx:559` | CategoryManageInline render/memo |
| microDoneToday | `src/pages/Home.jsx:827` | microChecks[selectedDate] | `src/pages/Home.jsx:827`, `src/pages/Home.jsx:1568` | Home render/memo |

## Top 10 hotspots

1. `src/pages/Home.jsx` (17 occurrences métriques)
2. `src/logic/metrics.test.js` (11 occurrences métriques)
3. `src/pages/Pilotage.jsx` (11 occurrences métriques)
4. `src/logic/pilotage.js` (11 occurrences métriques)
5. `src/features/pilotage/radarModel.js` (8 occurrences métriques)
6. `src/core/microActions/microActionsEngine.test.js` (7 occurrences métriques)
7. `src/logic/reporting.js` (6 occurrences métriques)
8. `src/ui/today/MicroActionsCard.jsx` (5 occurrences métriques)
9. `src/logic/metrics.js` (3 occurrences métriques)
10. `src/logic/reporting.test.js` (2 occurrences métriques)

## Où ça casse la clarté utilisateur

- `expected` n’a pas la même définition selon l’écran: `src/logic/metrics.js` inclut `canceled/skipped`, alors que Pilotage les exclut.
- La Bibliothèque calcule `planned` via `status !== "skipped"` (donc `canceled` reste compté), ce qui diffère de Pilotage.
- Les micro-actions sont visibles dans les détails Discipline (14j), mais le score principal reste basé sur les occurrences seulement.
- Le wording inverse `fait/attendu` vs `attendu/fait` augmente la charge cognitive.

## Ce qui doit être simplifié (UX)

- Définir 1 glossaire métier unique: `attendu`, `fait`, `manqué`, `annulé`, `discipline`, `progression`.
- Exposer une seule formule `discipline` (source unique) et l’utiliser sur Home + Pilotage + Reporting.
- Dissocier explicitement dans l’UI: `Score discipline` (occurrences) vs `Micro-actions réalisées` (engagement).
- Uniformiser l’ordre des ratios: toujours `fait / attendu`.
- Ajouter un bloc d’aide court sur Pilotage: “comment le score est calculé”.

## Recommandation de modèle unique de progression (proposition)

1. **Source unique calcul**: créer un module `progressionModel` qui retourne toutes les métriques normalisées (jour, 7j, 14j, 30j, 90j).
2. **Sémantique stable**: `attendu = planifié non annulé/non reporté` (ou autre), figée et testée une fois.
3. **Vues dérivées uniquement**: Home/Pilotage/Bibliothèque affichent les valeurs du modèle sans recalcul local ad hoc.
4. **Micro-actions branchées explicitement**: soit contribution au score global via pondération, soit KPI séparé non ambigu.
5. **Contrats de tests**: jeux de cas status (`planned/done/missed/canceled/skipped/rescheduled`) et snapshots par écran.

## Références clés

- `src/logic/metrics.js`
- `src/logic/pilotage.js`
- `src/features/pilotage/radarModel.js`
- `src/pages/Home.jsx`
- `src/pages/Pilotage.jsx`
- `src/ui/today/MicroActionsCard.jsx`
- `src/core/microActions/microActionsEngine.js`
- `src/features/library/CategoryManageInline.jsx`


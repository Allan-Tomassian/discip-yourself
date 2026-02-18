# Progression Inconsistencies

## 1) Sémantique `attendu` non uniforme

| Zone | Règle actuelle | Référence | Impact |
|---|---|---|---|
| Core metrics | `EXPECTED_STATUSES` inclut `planned/done/missed/canceled/skipped/rescheduled/in_progress` | `src/logic/metrics.js:13` | `expected` peut monter même avec des occurrences annulées/reportées |
| Pilotage discipline/load | `isOccExpected` exclut `canceled/skipped` | `src/logic/pilotage.js:37`, `src/logic/pilotage.js:42` | valeur `fait/attendu` différente de la métrique core |
| Radar insights | `expected` compte si status != `canceled/skipped` | `src/features/pilotage/radarModel.js:112` | Radar incohérent avec certains exports/report totals |
| Bibliothèque (actions) | `planned += 1` si status != `skipped` (donc `canceled` compte) | `src/features/library/CategoryManageInline.jsx:105` | ratio hebdo différent de Pilotage et Home |

## 2) Dupliques de calculs (même KPI, formules différentes)

- `done/expected` est recalculé dans plusieurs couches:
  - `src/logic/metrics.js:73`
  - `src/pages/Pilotage.jsx:64`
  - `src/logic/reporting.js:13`
  - `src/logic/reporting.js:152`
- Home calcule une progression locale `coreProgress` indépendante du module metrics:
  - `src/pages/Home.jsx:833`
- Home calcule `disciplineBreakdown` avec des sous-KPI maison (14j/90j/micro) en plus de `computeDisciplineScore`:
  - `src/pages/Home.jsx:849`

## 3) Incohérence “micro-actions vs score discipline”

- Les micro-actions influencent l’affichage détaillé Home (`microDone14`, `microRatio14`) mais pas le score discipline principal:
  - détails: `src/pages/Home.jsx:914`, `src/pages/Home.jsx:944`
  - score principal: `src/pages/Home.jsx:936`
- Le moteur micro-actions est persistant localement (`microActionsSeen`, `microActionsDone`) et côté data (`microChecks`) mais n’est pas branché au modèle Pilotage:
  - `src/ui/today/MicroActionsCard.jsx:13`
  - `src/ui/today/MicroActionsCard.jsx:14`
  - `src/pages/Home.jsx:1397`
  - absence de consommation dans `src/pages/Pilotage.jsx`

## 4) Wording hétérogène

- Inversion des termes selon écrans:
  - `fait / attendu` (`src/pages/Pilotage.jsx:789`)
  - `attendu / fait` (`src/pages/Pilotage.jsx:742`)
- Terminologie multiple pour des concepts proches:
  - “Progression du jour” (`src/pages/Home.jsx:1425`)
  - “Discipline” (`src/pages/Home.jsx:1460`)
  - “Occurrences attendues/faites/manquées/annulées” (`src/pages/Pilotage.jsx:1018`)

## 5) Fonctions de pilotage potentiellement orphelines

Ces fonctions existent mais ne sont pas branchées dans les pages principales:
- `getLoadSummary` (`src/logic/pilotage.js:233`)
- `getDisciplineSummary` (`src/logic/pilotage.js:284`)
- `getCategoryWeekBreakdown` (`src/logic/pilotage.js:420`)
- `getDisciplineStreak7d` (`src/logic/pilotage.js:453`)

Risque: maintenir des logiques non utilisées et divergentes des écrans réels.

## 6) Hotspots prioritaires (complexité / risque de drift)

1. `src/pages/Home.jsx`
2. `src/pages/Pilotage.jsx`
3. `src/logic/pilotage.js`
4. `src/features/pilotage/radarModel.js`
5. `src/logic/metrics.js`
6. `src/features/library/CategoryManageInline.jsx`
7. `src/logic/reporting.js`
8. `src/ui/today/MicroActionsCard.jsx`


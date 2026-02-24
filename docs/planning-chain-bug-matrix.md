# Planning Chain — Bug Matrix

| Priorité | ID | Problème | Impact utilisateur |
|---|---|---|---|
| P0 | `delete-action-schedule-rules-cleanup` | delete action cleanup should handle scheduleRules linked to removed goals | Actions supprimées pouvant réapparaître via occurrences orphelines |
| P0 | `missed-backfill-window` | planned->missed backfill appears constrained to selected date ±1 in Home | Historique planned/missed incomplet après inactivité |
| P1 | `status-vocabulary-divergence` | status values differ across modules (occurrence mutation vs planner/metrics/session) | Stats/session interprètent différemment certains statuts |
| P1 | `discipline-calculation-duplication-home-vs-model` | Home computes discipline through model and local loops in parallel | Incohérence potentielle |
| P1 | `create-flow-cognitive-load` | CreateV2Habits carries high field density and mixed concerns | Incohérence potentielle |
| P2 | `schedule-rules-sync-dual-implementations` | two schedule rule sync implementations coexist | Incohérence potentielle |

## P0 — delete action cleanup should handle scheduleRules linked to removed goals
- ID: `delete-action-schedule-rules-cleanup`
- Cause probable: deletes remove goals/occurrences/reminders but not scheduleRules; generator consumes active scheduleRules and can recreate orphan occurrences if rules remain active
- Preuves:
- `src/pages/Categories.jsx:384` — function deleteAction(goal) {
- `src/pages/Categories.jsx:391` — const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
- `src/features/library/CategoryManageInline.jsx:283` — function deleteAction(goal) {
- `src/features/library/CategoryManageInline.jsx:290` — const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
- `src/logic/occurrencePlanner.js:922` — const rulesRaw = Array.isArray(working.scheduleRules) ? working.scheduleRules : [];
- `src/logic/occurrencePlanner.js:1079` — const created = buildOccurrenceFromRule(rule, dateKey);
- Scénario de repro:
- Créer une action récurrente avec occurrences.
- Supprimer l’action depuis Bibliothèque.
- Déclencher ensureWindowFromScheduleRules (ouvrir Aujourd’hui / changer date).
- Observer réapparition d’occurrences orphelines ou stats incohérentes.

## P0 — planned->missed backfill appears constrained to selected date ±1 in Home
- ID: `missed-backfill-window`
- Cause probable: missed conversion occurs only for occurrences in provided window; Home ensures only a 3-day range around selected date, so old planned occurrences may remain planned after long inactivity
- Preuves:
- `src/pages/Home.jsx:1326` — const next = ensureWindowFromScheduleRules(prev, fromKey, toKey, sortedIds);
- `src/pages/Home.jsx:1324` — const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
- `src/pages/Home.jsx:1325` — const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
- `src/logic/occurrencePlanner.js:1111` — if (endMs == null || nowMs <= endMs) continue;
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };
- Scénario de repro:
- Créer des occurrences planifiées sur plusieurs jours futurs.
- Ne pas ouvrir l’app pendant plusieurs jours.
- Revenir sur Aujourd’hui: fenêtre ensure limitée à ±1 jour.
- Observer anciennes occurrences toujours planned au lieu de missed.

## P1 — status values differ across modules (occurrence mutation vs planner/metrics/session)
- ID: `status-vocabulary-divergence`
- Cause probable: planner writes missed; metrics track missed/rescheduled/in_progress; session final-state check in occurrences.js only treats done/skipped/canceled as final
- Preuves:
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };
- `src/logic/occurrences.js:137` — if (st === "done" || st === "skipped" || st === "canceled") {
- Scénario de repro:
- Forcer une occurrence avec status=missed via planner.
- Vérifier les modules qui considèrent les statuts finaux (session/local helpers).
- Observer divergence de traitement entre modules.

## P1 — Home computes discipline through model and local loops in parallel
- ID: `discipline-calculation-duplication-home-vs-model`
- Cause probable: score/ratio comes from progressionModel, but Home still derives additional habit/micro/outcome windows locally, increasing semantic drift risk with Pilotage/reporting
- Preuves:
- `src/pages/Home.jsx:1049` — ? computeWindowStats(safeData, oldestHistoryKey, yesterdayKey, { includeMicroContribution: true })
- `src/pages/Home.jsx:1090` — function countDoneForWindow(days) {
- `src/pages/Home.jsx:1112` — const habit14 = countDoneForWindow(14);
- `src/pages/Home.jsx:1113` — const habit90 = countDoneForWindow(90);
- `src/logic/progressionModel.js:113` — export function computeWindowStats(state, fromKey, toKey, options = {}) {
- Scénario de repro:
- Comparer score discipline Home vs Pilotage sur un jeu de données mixte.
- Modifier une sémantique locale (ex. 14j) et observer écart UI.

## P1 — CreateV2Habits carries high field density and mixed concerns
- ID: `create-flow-cognitive-load`
- Cause probable: single screen combines scheduling/time/period/reminder/quantity/conflict logic; uxV2 path exists but default flow remains legacy
- Preuves:
- `src/pages/CreateV2Habits.jsx:13` — } from "../components/UI";
- `src/pages/CreateV2Habits.jsx:278` — const [title, setTitle] = useState("");
- `src/pages/CreateV2Habits.jsx:279` — const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:280` — const [location, setLocation] = useState("");
- `src/pages/CreateV2Habits.jsx:283` — const [lifecycleMode] = useState("FIXED");
- `src/pages/CreateV2Habits.jsx:284` — const [activeFrom, setActiveFrom] = useState(() => todayLocalKey());
- Scénario de repro:
- Mesurer completion rate du flow débutant (type -> action -> catégorie).
- Observer abandon lorsque champs avancés apparaissent tôt.

## P2 — two schedule rule sync implementations coexist
- ID: `schedule-rules-sync-dual-implementations`
- Cause probable: duplicate sync pathways increase maintenance cost and can diverge behavior over time
- Preuves:
- `src/logic/scheduleRules.js:312` — export function syncScheduleRulesForActions(state, actionIds = null, now = new Date()) {
- `src/logic/scheduleRules.js:444` — export function ensureScheduleRulesForActions(state, actionIds = null, now = new Date()) {
- `src/logic/occurrencePlanner.js:918` — const synced = ensureScheduleRulesForActions(working, ids, now);
- Scénario de repro:
- `—`


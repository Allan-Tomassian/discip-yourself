# Audit Planning Chain (P0 logique)

- Généré le: 2026-02-24T11:22:41.411Z
- Scope: `src/**`, `tests/**`
- Fichiers scannés: src=201, tests=12, modules clés=29

## 1) Chaîne produit cartographiée

| Domaine | Fichiers clés |
|---|---|
| État planning (goals/occurrences) | `src/logic/goals.js`, `src/logic/occurrences.js` |
| Génération d’occurrences | `src/logic/occurrencePlanner.js`, `src/logic/scheduleRules.js` |
| Calendrier | `src/logic/calendar.js`, `src/ui/calendar/CalendarCard.jsx`, `src/ui/calendar/DayRail.jsx` |
| Pilotage/stats | `src/logic/metrics.js`, `src/logic/progressionModel.js`, `src/logic/pilotage.js`, `src/logic/reporting.js`, `src/features/pilotage/radarModel.js` |
| Orchestration app | `src/pages/Home.jsx`, `src/App.jsx` |
| Session | `src/pages/SessionMVP.jsx` |
| Création/planification | `src/pages/CreateV2Habits.jsx`, `src/pages/CreateV2HabitOneOff.jsx`, `src/pages/CreateV2HabitRecurring.jsx`, `src/pages/CreateV2HabitAnytime.jsx`, `src/pages/CreateV2Outcome.jsx`, `src/pages/CreateV2LinkOutcome.jsx`, `src/pages/CreateV2PickCategory.jsx`, `src/creation/creationSchema.js`, `src/creation/creationDraft.js` |
| Normalisation/migrations | `src/logic/state/normalizers.js`, `src/logic/state/migrations.js` |
| other | `src/pages/Categories.jsx`, `src/features/library/CategoryManageInline.jsx`, `src/pages/EditItem.jsx` |

## 2) Cohérence fonctionnelle (audit)

### ✅ Action ponctuelle sans heure
- Check: création + occurrence day-level + affichage today/calendar/pilotage
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action ponctuelle met à jour toute l’app" ; `tests/e2e/createFlow.spec.js` → "Action ponctuelle -> occurrence au bon jour"
- Preuves code:
- `src/pages/CreateV2Habits.jsx:174` — const isOneOff = repeat === "none";
- `src/pages/CreateV2Habits.jsx:177` — if (isOneOff) {
- `src/pages/CreateV2Habits.jsx:178` — const dateLabel = habit.oneOffDate ? ` · ${habit.oneOffDate}` : "";
- `src/pages/CreateV2Habits.jsx:279` — const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());

### ✅ Action ponctuelle avec heure
- Check: startTime fixé et occurrence fixe
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action ponctuelle met à jour toute l’app" ; `tests/e2e/createFlow.spec.js` → "Projet + Action (guidé) -> ouvre l’étape projet" ; `tests/e2e/createFlow.spec.js` → "Action ponctuelle -> occurrence au bon jour"
- Preuves code:
- `src/pages/CreateV2Habits.jsx:384` — (isTypeOneOff && timeMode === "FIXED") ||
- `src/pages/CreateV2Habits.jsx:876` — const startAt = isOneOff && occurrenceStart ? `${oneOffDate}T${occurrenceStart}` : null;

### ✅ Action récurrente simple
- Check: daysOfWeek + fixed time + génération multi-jours
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action récurrente valide planning/durée + conflit bloquant" ; `tests/e2e/createFlow.spec.js` → "Action récurrente planifiée -> planning + durée persistés" ; `tests/e2e/createFlow.spec.js` → "Action récurrente -> conflit horaire bloquant avant résolution"
- Preuves code:
- `src/pages/CreateV2HabitRecurring.jsx:14` — * - at least 1 day selected (daysOfWeek)
- `src/pages/CreateV2HabitRecurring.jsx:31` — const currentDays = Array.isArray(current.daysOfWeek) ? current.daysOfWeek : [];
- `src/pages/CreateV2HabitRecurring.jsx:63` — repeat: "weekly",
- `src/logic/scheduleRules.js:192` — export function buildScheduleRulesFromAction(action) {

### ✅ Récurrence jours spécifiques (lun/mer/ven)
- Check: daysOfWeek filtrés dans ruleAppliesOnDate
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action récurrente valide planning/durée + conflit bloquant" ; `tests/e2e/createFlow.spec.js` → "Action récurrente planifiée -> planning + durée persistés" ; `tests/e2e/createFlow.spec.js` → "Action récurrente -> conflit horaire bloquant avant résolution"
- Preuves code:
- `src/logic/scheduleRules.js:63` — function resolveDaysOfWeek(action, schedule) {
- `src/logic/scheduleRules.js:64` — const raw = Array.isArray(action?.daysOfWeek)
- `src/logic/scheduleRules.js:65` — ? action.daysOfWeek
- `src/logic/occurrencePlanner.js:694` — const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];

### ✅ Période activeFrom/activeTo
- Check: occurrences hors période supprimées ou non générées
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action ponctuelle met à jour toute l’app" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action récurrente valide planning/durée + conflit bloquant" ; `tests/e2e/createFlow.spec.js` → "Action ponctuelle -> occurrence au bon jour" ; `tests/e2e/createFlow.spec.js` → "Action récurrente planifiée -> planning + durée persistés"
- Preuves code:
- `src/logic/occurrencePlanner.js:105` — function isDateWithinPeriod(dateKey, period) {
- `src/logic/occurrencePlanner.js:386` — if (!isDateWithinPeriod(dateKey, period)) return false;
- `src/logic/occurrencePlanner.js:799` — const dates = buildWindowDates(fromDateKey, days).filter((k) => isDateWithinPeriod(k, period));
- `src/logic/occurrencePlanner.js:803` — // Period enforcement: remove occurrences for this goal that fall outside its active period.

### ✅ Modification après planification
- Check: rebuild occurrences via regenerateWindowFromScheduleRules
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action ponctuelle met à jour toute l’app" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action récurrente valide planning/durée + conflit bloquant" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action anytime sans horaire + présence dans les vues attendues"
- Preuves code:
- `src/pages/Categories.jsx:678` — const planChanged = prevPlanSig !== nextPlanSig;
- `src/pages/Categories.jsx:703` — next = regenerateWindowFromScheduleRules(next, goalId, fromKey, toKey);
- `src/pages/EditItem.jsx:787` — const planChanged = prevPlanSig !== nextPlanSig;
- `src/pages/EditItem.jsx:814` — next = regenerateWindowFromScheduleRules(next, goalId, fromKey, toKey);

### ✅ Suppression / canceled / skipped
- Check: cleanup coherence goals/occurrences/reminders/sessions/checks
- Couverture: **covered**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: action récurrente valide planning/durée + conflit bloquant" ; `tests/e2e/createFlow.appSync.spec.js` → "CategoryGate: désactivation non vide avec migration vers Général" ; `tests/e2e/createFlow.spec.js` → "Action récurrente -> conflit horaire bloquant avant résolution"
- Preuves code:
- `src/logic/occurrences.js:143` — export function setOccurrenceStatusById(occurrenceId, status, source) {
- `src/pages/Categories.jsx:384` — function deleteAction(goal) {

### ⚠️ Date sélectionnée différente de today
- Check: today/session et micro-actions restent cohérents
- Couverture: **partial**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "Calendrier mois: anti-décalage fin de mois vers mois suivant"
- Preuves code:
- `src/pages/Home.jsx:278` — const selectedDateKey =
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:281` — const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);
- `src/pages/Home.jsx:283` — const selectedStatus =

### ⚠️ Fuseau / dateKey cohérence
- Check: normalizeLocalDateKey across planning + calendar invariants
- Couverture: **partial**
- Tests repérés: `tests/e2e/createFlow.appSync.spec.js` → "Calendrier mois: anti-décalage fin de mois vers mois suivant"
- Preuves code:
- `src/pages/Home.jsx:11` — import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:397` — const dateKey = normalizeLocalDateKey(rawDate);
- `src/pages/Home.jsx:476` — const key = normalizeLocalDateKey(occ.date);

### ✅ Consistance expected/done/missed Home/Calendar/Pilotage
- Check: same semantics in metrics/progression/radar/reporting
- Couverture: **covered**
- Tests repérés: `src/logic/reporting.test.js` → "report totals match metrics" ; `tests/e2e/createFlow.appSync.spec.js` → "CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage" ; `tests/e2e/pilotage.radar.spec.js` → "Pilotage: Catégories visibles persistent après reload" ; `tests/e2e/pilotage.radar.spec.js` → "Pilotage: sélection radar reste valide après suppression d"
- Preuves code:
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/metrics.js:58` — if (EXPECTED_STATUSES.has(status)) stats.expected += 1;
- `src/logic/metrics.js:72` — const expected = Number(stats.expected) || 0;
- `src/logic/progressionModel.js:41` — export function computeExpectedDoneMissed(occurrences) {

## 3) P0/P1/P2 (priorisés)

### P0 — delete action cleanup should handle scheduleRules linked to removed goals
- Cause probable: deletes remove goals/occurrences/reminders but not scheduleRules; generator consumes active scheduleRules and can recreate orphan occurrences if rules remain active
- Preuves:
- `src/pages/Categories.jsx:384` — function deleteAction(goal) {
- `src/pages/Categories.jsx:391` — const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
- `src/features/library/CategoryManageInline.jsx:283` — function deleteAction(goal) {
- `src/features/library/CategoryManageInline.jsx:290` — const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
- `src/logic/occurrencePlanner.js:922` — const rulesRaw = Array.isArray(working.scheduleRules) ? working.scheduleRules : [];
- `src/logic/occurrencePlanner.js:1079` — const created = buildOccurrenceFromRule(rule, dateKey);

### P0 — planned->missed backfill appears constrained to selected date ±1 in Home
- Cause probable: missed conversion occurs only for occurrences in provided window; Home ensures only a 3-day range around selected date, so old planned occurrences may remain planned after long inactivity
- Preuves:
- `src/pages/Home.jsx:1326` — const next = ensureWindowFromScheduleRules(prev, fromKey, toKey, sortedIds);
- `src/pages/Home.jsx:1324` — const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
- `src/pages/Home.jsx:1325` — const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
- `src/logic/occurrencePlanner.js:1111` — if (endMs == null || nowMs <= endMs) continue;
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };

### P1 — status values differ across modules (occurrence mutation vs planner/metrics/session)
- Cause probable: planner writes missed; metrics track missed/rescheduled/in_progress; session final-state check in occurrences.js only treats done/skipped/canceled as final
- Preuves:
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };
- `src/logic/occurrences.js:137` — if (st === "done" || st === "skipped" || st === "canceled") {

### P1 — Home computes discipline through model and local loops in parallel
- Cause probable: score/ratio comes from progressionModel, but Home still derives additional habit/micro/outcome windows locally, increasing semantic drift risk with Pilotage/reporting
- Preuves:
- `src/pages/Home.jsx:1049` — ? computeWindowStats(safeData, oldestHistoryKey, yesterdayKey, { includeMicroContribution: true })
- `src/pages/Home.jsx:1090` — function countDoneForWindow(days) {
- `src/pages/Home.jsx:1112` — const habit14 = countDoneForWindow(14);
- `src/pages/Home.jsx:1113` — const habit90 = countDoneForWindow(90);
- `src/logic/progressionModel.js:113` — export function computeWindowStats(state, fromKey, toKey, options = {}) {

### P1 — CreateV2Habits carries high field density and mixed concerns
- Cause probable: single screen combines scheduling/time/period/reminder/quantity/conflict logic; uxV2 path exists but default flow remains legacy
- Preuves:
- `src/pages/CreateV2Habits.jsx:13` — } from "../components/UI";
- `src/pages/CreateV2Habits.jsx:278` — const [title, setTitle] = useState("");
- `src/pages/CreateV2Habits.jsx:279` — const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:280` — const [location, setLocation] = useState("");
- `src/pages/CreateV2Habits.jsx:283` — const [lifecycleMode] = useState("FIXED");
- `src/pages/CreateV2Habits.jsx:284` — const [activeFrom, setActiveFrom] = useState(() => todayLocalKey());

### P2 — two schedule rule sync implementations coexist
- Cause probable: duplicate sync pathways increase maintenance cost and can diverge behavior over time
- Preuves:
- `src/logic/scheduleRules.js:312` — export function syncScheduleRulesForActions(state, actionIds = null, now = new Date()) {
- `src/logic/scheduleRules.js:444` — export function ensureScheduleRulesForActions(state, actionIds = null, now = new Date()) {
- `src/logic/occurrencePlanner.js:918` — const synced = ensureScheduleRulesForActions(working, ids, now);

## 4) Audit UX logique du flow création (débutant)

- Constats:
- `CreateV2Habits` expose 23 états locaux (densité élevée).
- Le flow habit par défaut reste legacy: `oui` (cf. `src/creation/creationSchema.js`).
- Import legacy UI détecté dans le form principal: `oui`.
- Verdict UX logique: flow techniquement robuste, cognitivement dense pour débutant sans mode essentiel explicite.

## 5) Couverture tests actuelle

- Unit planning/stats: 13 fichiers
- E2E: 11 fichiers
- Principaux trous:
- Date sélectionnée différente de today: partial
- Fuseau / dateKey cohérence: partial

## 6) Verdict exécutable

- P0 bloquants logiques: 2 (voir `docs/planning-chain-bug-matrix.md`).
- Viabilité réelle: **oui**, mais avec dette logique sur suppression/scheduleRules et backfill missed.
- Recommandation avant grande refonte UI: corriger les P0 logiques puis simplifier le flow création (mode Essentiel).


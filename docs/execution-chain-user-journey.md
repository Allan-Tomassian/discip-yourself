# Execution Chain — User Journey (réel)

## 1) Planifier
- Ce que l’utilisateur fait: ouvre `+` puis choisit Projet/Action.
- Ce qu’il voit: modal guidée (`CreateFlowModal`) puis écrans CreateV2.
- Ce que l’app enregistre: draft create + goals + schedule fields + règles.
- Références:
- `src/ui/create/CreateFlowModal.jsx:6` — import CreateV2Outcome from "../../pages/CreateV2Outcome";
- `src/ui/create/CreateFlowModal.jsx:7` — import CreateV2HabitType from "../../pages/CreateV2HabitType";
- `src/ui/create/CreateFlowModal.jsx:8` — import CreateV2HabitOneOff from "../../pages/CreateV2HabitOneOff";
- `src/pages/CreateV2Habits.jsx:152` — function validateWeeklySlotsByDay(daysOfWeek, weeklySlotsByDay) {
- `src/pages/CreateV2Habits.jsx:153` — const days = normalizeDaysOfWeek(daysOfWeek);

## 2) Voir au calendrier
- Ce que l’utilisateur fait: ouvre le calendrier (jour/mois).
- Ce qu’il voit: compteurs planifié/fait par date.
- Ce que l’app lit: occurrences `planned`/`done` normalisées via dateKey.
- Friction: ajout d’occurrence potentiellement non câblé selon parent.
- Références:
- `src/logic/occurrencePlanner.js:683` — function ruleAppliesOnDate(rule, dateKey) {
- `src/logic/occurrencePlanner.js:700` — function buildOccurrenceFromRule(rule, dateKey) {
- `src/logic/occurrencePlanner.js:913` — export function ensureWindowFromScheduleRules(data, fromKey, toKey, actionIds = null, now = new Date()) {
- `src/logic/scheduleRules.js:192` — export function buildScheduleRulesFromAction(action) {
- `src/logic/scheduleRules.js:312` — export function syncScheduleRulesForActions(state, actionIds = null, now = new Date()) {
- `src/logic/scheduleRules.js:332` — const desiredRules = buildScheduleRulesFromAction(action);

## 3) Arriver dans Aujourd’hui
- Ce que l’utilisateur fait: choisit une date puis lit “À faire maintenant”.
- Ce qu’il voit: focus occurrence + CTA démarrer.
- Ce que l’app calcule: selectedDate/localToday, planned/day, done/day, focusOccurrence.
- Friction: fenêtre de recalcul locale pouvant masquer les missed anciens.
- Références:
- `src/pages/Home.jsx:278` — const selectedDateKey =
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:281` — const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);
- `src/pages/Home.jsx:807` — const focusOccurrence = focusOverrideOccurrence || focusBaseOccurrence;
- `src/pages/Home.jsx:817` — excludeId: focusOccurrence?.id || null,
- `src/pages/Home.jsx:819` — [focusOccurrence?.id, plannedOccurrencesForDay, selectedDateKey]

## 4) Passer en exécution / session
- Ce que l’utilisateur fait: clique “Commencer maintenant”.
- Ce qu’il voit: tab session (implémentation MVP).
- Ce que l’app enregistre: `ui.activeSession`, puis statut occurrence via actions session.
- Friction: coexistence d’une page Session avancée non branchée.
- Références:
- `src/App.jsx:38` — import SessionMVP from "./pages/SessionMVP";
- `src/App.jsx:895` — ) : tab === "session" ? (
- `src/App.jsx:896` — <SessionMVP
- `src/pages/SessionMVP.jsx:4` — import { setOccurrenceStatusById } from "../logic/occurrences";
- `src/pages/SessionMVP.jsx:108` — const nextOccurrences = setOccurrenceStatusById(selectedOccurrence.id, status, prev);
- `src/pages/SessionMVP.jsx:153` — Reporter

## 5) Valider / clôturer
- Ce que l’utilisateur fait: Terminer / Reporter / Annuler.
- Ce que l’app enregistre: status occurrence + session history (selon chemin).
- Risque: vocabulaire de statuts partiellement divergent entre modules.
- Références:
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/occurrences.js:46` — return STATUS_VALUES.has(raw) ? raw : "planned";
- `src/logic/occurrences.js:143` — export function setOccurrenceStatusById(occurrenceId, status, source) {
- `src/pages/EditItem.jsx:756` — updatedOccurrences = setOccurrenceStatusById(occId, "canceled", { occurrences: updatedOccurrences });
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([

## 6) Mesurer dans Pilotage
- Ce que l’utilisateur fait: ouvre Pilotage.
- Ce qu’il voit: discipline, radar, reporting.
- Ce que l’app calcule: `computeWindowStats`, `metrics`, `radarModel`, `reporting`.
- Références:
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/metrics.js:58` — if (EXPECTED_STATUSES.has(status)) stats.expected += 1;
- `src/logic/metrics.js:141` — export function computeDailyStats(state, fromKey, toKey, filters = {}) {
- `src/logic/progressionModel.js:4` — export const MICRO_ACTION_WEIGHT = 0.25;
- `src/logic/progressionModel.js:41` — export function computeExpectedDoneMissed(occurrences) {
- `src/logic/progressionModel.js:81` — export function computeMicroActionContribution(state, fromKey, toKey, { weight = MICRO_ACTION_WEIGHT } = {}) {

## Frictions clés
- Nettoyage suppression action incomplet (rules vs occurrences).
- Backfill `missed` possiblement localisé.
- Session runtime fragmentée (MVP vs version riche).
- Flow création trop dense pour débutant.


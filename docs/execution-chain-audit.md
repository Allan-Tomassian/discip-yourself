# 1) Verdict global (max 12 lignes)

- Le moteur de planification est **fonctionnel**, mais pas totalement cohérent de bout en bout sur les cas limites.
- La chaîne nominale création → occurrences → today → validation → pilotage passe dans la plupart des scénarios testés.
- Deux dettes P0 fragilisent la fiabilité réelle: cleanup scheduleRules à la suppression et backfill `missed` trop local.
- La chaîne Today → Session est **partielle**: app branchée sur `SessionMVP`, tandis que `Session.jsx` plus riche n’est pas le chemin runtime.
- La sémantique des statuts n’est pas parfaitement unifiée entre occurrences, planner, metrics et resolver.
- Pour un débutant, le flow de création reste trop dense (charge cognitive élevée).
- Applicabilité “vie réelle”: possible, mais fragile pour les utilisateurs irréguliers (retour après absence).
- Avant redesign UI, il faut fermer les incohérences logiques P0/P1.

# 2) Cartographie de la chaîne (étapes + composants + logique)

## Création / Planification
- Étape: `planning`
- Composants/modules: `src/ui/create/CreateFlowModal.jsx`, `src/pages/CreateV2Habits.jsx`, `src/creation/creationDraft.js`, `src/creation/creationSchema.js`
- Preuves:
- `src/ui/create/CreateFlowModal.jsx:6` — import CreateV2Outcome from "../../pages/CreateV2Outcome";
- `src/ui/create/CreateFlowModal.jsx:7` — import CreateV2HabitType from "../../pages/CreateV2HabitType";
- `src/ui/create/CreateFlowModal.jsx:8` — import CreateV2HabitOneOff from "../../pages/CreateV2HabitOneOff";
- `src/pages/CreateV2Habits.jsx:152` — function validateWeeklySlotsByDay(daysOfWeek, weeklySlotsByDay) {

## Persistance / normalisation
- Étape: `persistence`
- Composants/modules: `src/data/useUserData.js`, `src/logic/state/migrations.js`, `src/logic/state/normalizers.js`
- Preuves:
- `src/data/useUserData.js:5` — import { loadState, saveState } from "../utils/storage";
- `src/data/useUserData.js:6` — import { isRemoteUserDataEnabled, loadUserData, upsertUserData } from "./userDataApi";
- `src/data/useUserData.js:48` — if (!isPlainObject(value)) return migrate(initialData());
- `src/logic/state/migrations.js:10` — import { buildScheduleRuleSourceKey, buildScheduleRulesFromAction, normalizeScheduleRule } from "../scheduleRules";

## Calendrier / occurrences
- Étape: `calendar`
- Composants/modules: `src/logic/occurrencePlanner.js`, `src/logic/scheduleRules.js`, `src/ui/calendar/CalendarCard.jsx`, `src/pages/Home.jsx`
- Preuves:
- `src/logic/occurrencePlanner.js:683` — function ruleAppliesOnDate(rule, dateKey) {
- `src/logic/occurrencePlanner.js:700` — function buildOccurrenceFromRule(rule, dateKey) {
- `src/logic/occurrencePlanner.js:913` — export function ensureWindowFromScheduleRules(data, fromKey, toKey, actionIds = null, now = new Date()) {
- `src/logic/scheduleRules.js:192` — export function buildScheduleRulesFromAction(action) {

## Aujourd’hui / sélection du jour
- Étape: `today`
- Composants/modules: `src/pages/Home.jsx`, `src/ui/focus/FocusCard.jsx`
- Preuves:
- `src/pages/Home.jsx:278` — const selectedDateKey =
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:281` — const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);
- `src/pages/Home.jsx:807` — const focusOccurrence = focusOverrideOccurrence || focusBaseOccurrence;

## Exécution / Session
- Étape: `execution`
- Composants/modules: `src/App.jsx`, `src/pages/SessionMVP.jsx`, `src/pages/Session.jsx`, `src/logic/sessionResolver.js`
- Preuves:
- `src/App.jsx:38` — import SessionMVP from "./pages/SessionMVP";
- `src/App.jsx:895` — ) : tab === "session" ? (
- `src/App.jsx:896` — <SessionMVP
- `src/pages/SessionMVP.jsx:4` — import { setOccurrenceStatusById } from "../logic/occurrences";

## Validation / statuts
- Étape: `validation`
- Composants/modules: `src/logic/occurrences.js`, `src/pages/EditItem.jsx`
- Preuves:
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/occurrences.js:46` — return STATUS_VALUES.has(raw) ? raw : "planned";
- `src/logic/occurrences.js:143` — export function setOccurrenceStatusById(occurrenceId, status, source) {
- `src/pages/EditItem.jsx:756` — updatedOccurrences = setOccurrenceStatusById(occId, "canceled", { occurrences: updatedOccurrences });

## Pilotage / progression
- Étape: `pilotage`
- Composants/modules: `src/logic/metrics.js`, `src/logic/progressionModel.js`, `src/pages/Pilotage.jsx`, `src/features/pilotage/radarModel.js`
- Preuves:
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/metrics.js:58` — if (EXPECTED_STATUSES.has(status)) stats.expected += 1;
- `src/logic/metrics.js:141` — export function computeDailyStats(state, fromKey, toKey, filters = {}) {
- `src/logic/progressionModel.js:4` — export const MICRO_ACTION_WEIGHT = 0.25;

# 3) Incohérences fonctionnelles (P0/P1/P2)

## P0 — Suppression d’action sans cleanup explicite des scheduleRules
- Problème observé: Suppression d’action sans cleanup explicite des scheduleRules
- Impact utilisateur: Risque d’occurrences orphelines régénérées après suppression
- Cause probable: planning->calendar + implémentation dispersée
- Preuves:
- `src/pages/Categories.jsx:384` — function deleteAction(goal) {
- `src/pages/Categories.jsx:391` — const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
- `src/features/library/CategoryManageInline.jsx:283` — function deleteAction(goal) {
- `src/logic/occurrencePlanner.js:922` — const rulesRaw = Array.isArray(working.scheduleRules) ? working.scheduleRules : [];
- Repro:
- Créer action récurrente.
- Supprimer action depuis Bibliothèque.
- Revenir sur Today (ensureWindow).
- Vérifier réapparition/compteurs incohérents.

## P0 — Backfill des missed contraint à la fenêtre selectedDate ±1
- Problème observé: Backfill des missed contraint à la fenêtre selectedDate ±1
- Impact utilisateur: Occurences anciennes potentiellement laissées en planned après longue absence
- Cause probable: today->validation + implémentation dispersée
- Preuves:
- `src/pages/Home.jsx:1326` — const next = ensureWindowFromScheduleRules(prev, fromKey, toKey, sortedIds);
- `src/pages/Home.jsx:1324` — const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
- `src/pages/Home.jsx:1325` — const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };
- Repro:
- Planifier sur plusieurs jours.
- Ne pas ouvrir l’app plusieurs jours.
- Revenir Today sans parcourir les jours passés.
- Comparer planned/missed attendu vs affiché.

## P1 — Le tab session monte SessionMVP; Session.jsx riche existe mais n’est pas branché
- Problème observé: Le tab session monte SessionMVP; Session.jsx riche existe mais n’est pas branché
- Impact utilisateur: Risque de logique/exigences d’exécution fragmentées (deux implémentations)
- Cause probable: today->execution + implémentation dispersée
- Preuves:
- `src/App.jsx:38` — import SessionMVP from "./pages/SessionMVP";
- `src/App.jsx:895` — ) : tab === "session" ? (
- `src/App.jsx:896` — <SessionMVP
- `src/pages/Session.jsx:50` — export default function Session({ data, setData, onBack, onOpenLibrary, dateKey }) {
- Repro:
- Démarrer une session depuis Today.
- Observer que l’écran session correspond au MVP.
- Comparer fonctionnalités attendues vs Session.jsx.

## P1 — API sessions.js présente mais flux actif basé sur ui.activeSession + sessionsV2
- Problème observé: API sessions.js présente mais flux actif basé sur ui.activeSession + sessionsV2
- Impact utilisateur: Dette de maintenance et confusion sur la source de vérité de session
- Cause probable: execution->validation + implémentation dispersée
- Preuves:
- `src/logic/sessions.js:65` — export function startSessionForOccurrence(state, occurrenceId, now = new Date()) {
- `src/logic/sessionsV2.js:56` — export function upsertSessionV2(list, record) {
- `src/pages/SessionMVP.jsx:37` — safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
- `src/pages/SessionMVP.jsx:38` — const activeSession = useMemo(() => normalizeActiveSessionForUI(rawActiveSession), [rawActiveSession]);
- `src/pages/Home.jsx:706` — safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
- `src/pages/Home.jsx:707` — const activeSession = useMemo(
- Repro:
- Comparer état écrit dans ui.activeSession et sessionHistory.
- Vérifier si sessions[] est encore utilisé par le runtime.

## P1 — Vocabulaire de statuts différent selon modules
- Problème observé: Vocabulaire de statuts différent selon modules
- Impact utilisateur: Interprétation divergente des statuts finaux et expected
- Cause probable: validation->pilotage + implémentation dispersée
- Preuves:
- `src/logic/occurrences.js:4` — const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/occurrencePlanner.js:1112` — const patch = { status: "missed", updatedAt: nowIso };
- `src/logic/sessionResolver.js:2` — import { isFinalOccurrenceStatus as isFinalOccurrenceStatusFromMetrics } from "./metrics";
- Repro:
- Injecter une occurrence status=missed.
- Comparer rendu/calcul Home, Session resolver et Pilotage.

## P1 — Flow création dense pour débutant; mode Essentiel non explicite
- Problème observé: Flow création dense pour débutant; mode Essentiel non explicite
- Impact utilisateur: Abandon en création et confusion entre Quick/Focus planning
- Cause probable: planning + implémentation dispersée
- Preuves:
- `src/pages/CreateV2Habits.jsx:278` — const [title, setTitle] = useState("");
- `src/pages/CreateV2Habits.jsx:279` — const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:280` — const [location, setLocation] = useState("");
- `src/pages/CreateV2Habits.jsx:283` — const [lifecycleMode] = useState("FIXED");
- `src/pages/CreateV2Habits.jsx:284` — const [activeFrom, setActiveFrom] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:285` — const [activeTo, setActiveTo] = useState(() => addDaysLocal(todayLocalKey(), 29));
- Repro:
- Créer action récurrente avec options avancées.
- Mesurer nombre de champs obligatoires/perçus.
- Comparer avec flow simple attendu (titre+jour+heure).

## P2 — CTA Ajouter occurrence dans calendrier potentiellement non câblé au parent
- Problème observé: CTA Ajouter occurrence dans calendrier potentiellement non câblé au parent
- Impact utilisateur: Action UI visible mais sans effet selon contexte
- Cause probable: calendar->today + implémentation dispersée
- Preuves:
- `src/pages/Home.jsx:271` — onAddOccurrence,
- `src/pages/Home.jsx:2129` — onAddOccurrence={typeof onAddOccurrence === "function" ? handleAddOccurrence : null}
- `src/App.jsx:614` — <Home
- Repro:
- Ouvrir calendrier mois Today.
- Cliquer Ajouter sur un jour.
- Vérifier création effective d’occurrence.

# 4) Frictions UX réelles (utilisateur débutant)

- Le flow de création concentre trop d’options dans les écrans actions (temps, fréquence, période, conflits).
- La notion de “Session” est ambiguë car deux implémentations coexistent en code, une seule visible en runtime.
- La différence “agir maintenant” vs “planifier finement” est implicite, pas explicite dans l’orchestration.
- Risque de perte de confiance si des occurrences anciennes restent `planned` au lieu de `missed`.
- Preuves:
- `src/pages/CreateV2Habits.jsx:278` — const [title, setTitle] = useState("");
- `src/pages/CreateV2Habits.jsx:279` — const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:280` — const [location, setLocation] = useState("");
- `src/pages/CreateV2Habits.jsx:283` — const [lifecycleMode] = useState("FIXED");
- `src/pages/CreateV2Habits.jsx:284` — const [activeFrom, setActiveFrom] = useState(() => todayLocalKey());
- `src/pages/CreateV2Habits.jsx:285` — const [activeTo, setActiveTo] = useState(() => addDaysLocal(todayLocalKey(), 29));

# 5) Ambiguïtés produit à résoudre avant redesign UI

- Quelle implémentation Session est la source de vérité (MVP actuel ou version riche `Session.jsx`)?
- Que signifie exactement `missed` sur retour d’absence prolongée (backfill systématique vs local)?
- Quelle granularité de validation est attendue pour action sans heure (ANYTIME) ?
- Quel niveau de friction anti-triche V1 cible-t-on (minimal / moyen / strict) ?
- L’action “Ajouter occurrence” depuis calendrier Today doit-elle être active en production ou masquée ?

# 6) Recommandation sur Session (garder / transformer / remplacer)

- Recommandation: **transformer**.
- État actuel: Page dédiée (tab session) ouvrant SessionMVP; Session.jsx avancée non branchée.
- Proposition: Transformer Session en mode d’exécution unifié (single implementation), pas deux écrans concurrents.
- Justification:
- `src/App.jsx:895` — ) : tab === "session" ? (
- `src/App.jsx:896` — <SessionMVP
- `src/pages/Session.jsx:50` — export default function Session({ data, setData, onBack, onOpenLibrary, dateKey }) {

# 7) Recommandation Quick Action vs Focus Block (V1)

- Recommandation V1:
- `Quick Action` = action ANYTIME exécutable sans durée obligatoire, validation simple.
- `Focus Block` = occurrence planifiée (heure/durée), session structurée, retour validation explicite.
- Base code existante: ANYTIME/RECURRING/ONE_OFF existent côté modèle; Focus Today met en avant une occurrence planifiée.
- Preuves:
- `src/creation/creationDraft.js:17` — const HABIT_TYPES = new Set(["ONE_OFF", "RECURRING", "ANYTIME"]);
- `src/creation/creationDraft.js:254` — // ONE_OFF: due on a single date, no expectedDays, no per-day slots.
- `src/pages/Home.jsx:807` — const focusOccurrence = focusOverrideOccurrence || focusBaseOccurrence;
- `src/pages/Home.jsx:817` — excludeId: focusOccurrence?.id || null,

# 8) Plan de correction priorisé (ordre exact)

1. P0 logique: cleanup `scheduleRules` lors suppression action + garde-fou anti-occurrences orphelines.
2. P0 logique: stratégie de backfill `missed` cohérente au-delà de la fenêtre Today ±1.
3. P1 architecture: unifier Session runtime (éliminer bifurcation MVP vs page riche).
4. P1 sémantique: harmoniser vocabulaire de statuts entre occurrences/planner/metrics/session.
5. P1 UX: découper flow création en Essentiel/Avancé sans toucher au moteur.
6. P2: traiter chemins UI secondaires non câblés (ex: ajout occurrence depuis calendrier si confirmé).

# 9) Test matrix minimale avant refonte visuelle

- Vérifier suppression d’action récurrente + non-régénération d’occurrences.
- Vérifier retour après 5+ jours sans ouverture (planned -> missed cohérent).
- Vérifier séquence Today -> Session -> Done -> Pilotage sur one-off / recurring / anytime.
- Vérifier cohérence des totaux expected/done/missed entre Home, Calendar, Pilotage, Reporting.
- Vérifier comportement selectedDate != today (lecture seule, exécution, micro-actions).
- Détail des cas: voir `docs/execution-chain-test-matrix.md`.

# 10) Ce qu’on ne doit PAS toucher tout de suite (pour éviter dispersion)

- Refonte visuelle lourde des pages (déjà engagée sur d’autres lots).
- Système Wallet/Totem/Ads (hors impact direct sur la chaîne d’exécution cœur).
- Ajout de nouvelles features produit avant fermeture des P0 logiques.
- Refonte navigation globale tant que Session et statuts ne sont pas unifiés.

## Notes de conformité (OK / Partiel / KO)

- Chaîne planification → calendrier cohérente: **Partiel** — Génération OK, mais suppression d’action peut laisser des règles réinjectables.
- Chaîne planification → Today cohérente: **Partiel** — Today assure la fenêtre locale mais peut sous-traiter l’historique missed.
- Chaîne Today → exécution/session cohérente: **Partiel** — Today ouvre bien une session, mais deux implémentations coexistent (MVP vs page riche).
- Chaîne exécution/session → validation cohérente: **Partiel** — Validation fonctionne, mais source de vérité session dispersée.
- Chaîne validation → pilotage/progression cohérente: **Partiel** — Calculs robustes globalement, mais sémantique statuts non homogène.
- Compréhensibilité utilisateur (débutant): **KO** — Flow création trop dense; mode Essentiel implicite.
- Applicabilité dans la vraie vie (usage réel): **Partiel** — Boucle existe (planifier->exécuter->valider->analyser), mais friction création et ambiguïtés session freinent l’usage régulier.
- Prêt pour itération “Flow Rapide / Affiner”: **Partiel** — La logique supporte déjà les types ONE_OFF/RECURRING/ANYTIME; segmentation UX Essentiel/Avancé faisable sans changer le moteur.


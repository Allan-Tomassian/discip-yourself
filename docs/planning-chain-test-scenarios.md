# Planning Chain — Test Scenarios Matrix

| Scénario | Couverture actuelle | Tests repérés | Priorité ajout |
|---|---|---|---|
| Action ponctuelle sans heure | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app ; tests/e2e/createFlow.spec.js::Action ponctuelle -> occurrence au bon jour | P2 |
| Action ponctuelle avec heure | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app | P2 |
| Action récurrente simple | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action récurrente valide planning/durée + conflit bloquant ; tests/e2e/createFlow.spec.js::Action récurrente planifiée -> planning + durée persistés | P2 |
| Récurrence jours spécifiques (lun/mer/ven) | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action récurrente valide planning/durée + conflit bloquant ; tests/e2e/createFlow.spec.js::Action récurrente planifiée -> planning + durée persistés | P2 |
| Période activeFrom/activeTo | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: action récurrente valide planning/durée + conflit bloquant | P2 |
| Modification après planification | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: action ponctuelle met à jour toute l’app | P2 |
| Suppression / canceled / skipped | ✅ covered | tests/e2e/createFlow.appSync.spec.js::CreateFlow: action récurrente valide planning/durée + conflit bloquant ; tests/e2e/createFlow.appSync.spec.js::CategoryGate: désactivation non vide avec migration vers Général | P2 |
| Date sélectionnée différente de today | ⚠️ partial | tests/e2e/createFlow.appSync.spec.js::Calendrier mois: anti-décalage fin de mois vers mois suivant | P1 |
| Fuseau / dateKey cohérence | ⚠️ partial | tests/e2e/createFlow.appSync.spec.js::Calendrier mois: anti-décalage fin de mois vers mois suivant | P1 |
| Consistance expected/done/missed Home/Calendar/Pilotage | ✅ covered | src/logic/reporting.test.js::report totals match metrics ; tests/e2e/createFlow.appSync.spec.js::CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage | P2 |

## Scénarios manuels/e2e recommandés

### Action ponctuelle sans heure
- Objectif:
- création + occurrence day-level + affichage today/calendar/pilotage
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/CreateV2Habits.jsx:174` — const isOneOff = repeat === "none";
- `src/pages/CreateV2Habits.jsx:177` — if (isOneOff) {
- `src/pages/CreateV2Habits.jsx:178` — const dateLabel = habit.oneOffDate ? ` · ${habit.oneOffDate}` : "";

### Action ponctuelle avec heure
- Objectif:
- startTime fixé et occurrence fixe
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/CreateV2Habits.jsx:384` — (isTypeOneOff && timeMode === "FIXED") ||
- `src/pages/CreateV2Habits.jsx:876` — const startAt = isOneOff && occurrenceStart ? `${oneOffDate}T${occurrenceStart}` : null;

### Action récurrente simple
- Objectif:
- daysOfWeek + fixed time + génération multi-jours
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/CreateV2HabitRecurring.jsx:14` — * - at least 1 day selected (daysOfWeek)
- `src/pages/CreateV2HabitRecurring.jsx:31` — const currentDays = Array.isArray(current.daysOfWeek) ? current.daysOfWeek : [];
- `src/pages/CreateV2HabitRecurring.jsx:63` — repeat: "weekly",

### Récurrence jours spécifiques (lun/mer/ven)
- Objectif:
- daysOfWeek filtrés dans ruleAppliesOnDate
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/logic/scheduleRules.js:63` — function resolveDaysOfWeek(action, schedule) {
- `src/logic/scheduleRules.js:64` — const raw = Array.isArray(action?.daysOfWeek)
- `src/logic/scheduleRules.js:65` — ? action.daysOfWeek

### Période activeFrom/activeTo
- Objectif:
- occurrences hors période supprimées ou non générées
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/logic/occurrencePlanner.js:105` — function isDateWithinPeriod(dateKey, period) {
- `src/logic/occurrencePlanner.js:386` — if (!isDateWithinPeriod(dateKey, period)) return false;
- `src/logic/occurrencePlanner.js:799` — const dates = buildWindowDates(fromDateKey, days).filter((k) => isDateWithinPeriod(k, period));

### Modification après planification
- Objectif:
- rebuild occurrences via regenerateWindowFromScheduleRules
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/Categories.jsx:678` — const planChanged = prevPlanSig !== nextPlanSig;
- `src/pages/Categories.jsx:703` — next = regenerateWindowFromScheduleRules(next, goalId, fromKey, toKey);
- `src/pages/EditItem.jsx:787` — const planChanged = prevPlanSig !== nextPlanSig;

### Suppression / canceled / skipped
- Objectif:
- cleanup coherence goals/occurrences/reminders/sessions/checks
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/logic/occurrences.js:143` — export function setOccurrenceStatusById(occurrenceId, status, source) {
- `src/pages/Categories.jsx:384` — function deleteAction(goal) {

### Date sélectionnée différente de today
- Objectif:
- today/session et micro-actions restent cohérents
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/Home.jsx:278` — const selectedDateKey =
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:281` — const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);

### Fuseau / dateKey cohérence
- Objectif:
- normalizeLocalDateKey across planning + calendar invariants
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/pages/Home.jsx:11` — import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
- `src/pages/Home.jsx:279` — normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
- `src/pages/Home.jsx:397` — const dateKey = normalizeLocalDateKey(rawDate);

### Consistance expected/done/missed Home/Calendar/Pilotage
- Objectif:
- same semantics in metrics/progression/radar/reporting
- Steps:
- Préparer état de base avec catégories + action(s) ciblée(s).
- Exécuter le flow création/modification/suppression selon scénario.
- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.
- Vérifier persistance après reload.
- Références code:
- `src/logic/metrics.js:13` — const EXPECTED_STATUSES = new Set([
- `src/logic/metrics.js:58` — if (EXPECTED_STATUSES.has(status)) stats.expected += 1;
- `src/logic/metrics.js:72` — const expected = Number(stats.expected) || 0;


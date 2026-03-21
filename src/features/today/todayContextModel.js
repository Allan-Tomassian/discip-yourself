import { getNextPlannedOccurrence } from "../../core/focus/focusSelector";
import { resolveTodayDatePhase } from "../../domain/todayIntervention";
import { normalizeActiveSessionForUI } from "../../logic/compat";
import { isRuntimeSessionOpen } from "../../logic/sessionRuntime";
import { normalizeLocalDateKey, todayLocalKey } from "../../utils/dateKey";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveActiveDate(selectedDateKey) {
  return normalizeLocalDateKey(selectedDateKey) || todayLocalKey();
}

export function deriveTodayContextModel({
  selectedDateKey,
  rawActiveSession,
  plannedOccurrencesForDay,
  now = new Date(),
}) {
  const activeDate = resolveActiveDate(selectedDateKey);
  const systemToday = normalizeLocalDateKey(now) || todayLocalKey();
  const isToday = activeDate === systemToday;
  const datePhase = resolveTodayDatePhase({ activeDate, systemToday });
  const normalizedSession = normalizeActiveSessionForUI(rawActiveSession);
  const openSession = isRuntimeSessionOpen(normalizedSession) ? normalizedSession : null;
  const sessionDateKey = normalizeLocalDateKey(openSession?.dateKey || openSession?.date || "");
  const activeSessionForActiveDate = sessionDateKey === activeDate ? openSession : null;
  const openSessionOutsideActiveDate =
    openSession && sessionDateKey && sessionDateKey !== activeDate ? openSession : null;
  const futureSessions =
    openSessionOutsideActiveDate && sessionDateKey > activeDate ? [openSessionOutsideActiveDate] : [];
  const plannedActionsForActiveDate = safeArray(plannedOccurrencesForDay)
    .filter((occurrence) => occurrence && normalizeLocalDateKey(occurrence.date) === activeDate);
  const focusOccurrenceForActiveDate = getNextPlannedOccurrence({
    dateKey: activeDate,
    now,
    occurrences: plannedActionsForActiveDate,
  });

  return {
    activeDate,
    systemToday,
    isToday,
    datePhase,
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    plannedActionsForActiveDate,
    focusOccurrenceForActiveDate,
  };
}

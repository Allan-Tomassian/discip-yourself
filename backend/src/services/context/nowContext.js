import {
  buildCategoryStatus,
  resolveFocusOccurrenceForDate,
  resolvePlannedActionsForDate,
  resolveSessionSplitForDate,
  buildWindowStats,
  normalizeDateKey,
  resolveCategory,
  resolveGoalMap,
  resolveOccurrencesForDate,
  safeArray,
} from "./shared.js";

export function buildNowContext({
  data,
  selectedDateKey,
  activeCategoryId,
  quotaState,
  requestId,
  trigger,
  now = new Date(),
}) {
  const dateKey = normalizeDateKey(selectedDateKey);
  const systemToday = normalizeDateKey(now);
  const category = resolveCategory(data, activeCategoryId);
  const categoryId = category?.id || null;
  const goalsById = resolveGoalMap(data);
  const dayOccurrences = resolveOccurrencesForDate(data, dateKey, categoryId);
  const plannedActionsForActiveDate = resolvePlannedActionsForDate(data, dateKey, categoryId);
  const { activeSessionForActiveDate, openSessionOutsideActiveDate, futureSessions } = resolveSessionSplitForDate(
    data,
    dateKey
  );
  const focusOccurrenceForActiveDate = resolveFocusOccurrenceForDate({
    dateKey,
    now,
    occurrences: plannedActionsForActiveDate,
  });
  const doneToday = dayOccurrences.filter((occurrence) => occurrence?.status === "done").length;
  const missedToday = dayOccurrences.filter((occurrence) => occurrence?.status === "missed").length;
  const remainingToday = plannedActionsForActiveDate.length;
  const recentHistory = safeArray(data?.sessionHistory).slice(-5);
  const discipline7d = buildWindowStats(data, dateKey, 7);

  return {
    requestId,
    trigger,
    activeDate: dateKey,
    isToday: Boolean(dateKey && systemToday && dateKey === systemToday),
    selectedDateKey: dateKey,
    activeCategoryId: categoryId,
    category,
    goalsById,
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    plannedActionsForActiveDate,
    focusOccurrenceForActiveDate,
    activeSession: activeSessionForActiveDate,
    topOccurrence: focusOccurrenceForActiveDate,
    dayOccurrences,
    recentHistory,
    doneToday,
    missedToday,
    remainingToday,
    discipline7d,
    categoryStatus: categoryId ? buildCategoryStatus(data, categoryId, dateKey) : "EMPTY",
    quotaRemaining: quotaState.remaining,
  };
}

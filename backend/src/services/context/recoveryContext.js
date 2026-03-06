import {
  buildCategoryStatus,
  buildWindowStats,
  normalizeDateKey,
  resolveActiveSessionForDate,
  resolveCategory,
  resolveGoalMap,
  resolveOccurrencesForDate,
  sortOccurrencesForExecution,
} from "./shared.js";

export function buildRecoveryContext({ data, selectedDateKey, activeCategoryId, quotaState, requestId, trigger }) {
  const dateKey = normalizeDateKey(selectedDateKey);
  const category = resolveCategory(data, activeCategoryId);
  const categoryId = category?.id || null;
  const goalsById = resolveGoalMap(data);
  const dayOccurrences = resolveOccurrencesForDate(data, dateKey, categoryId);
  const activeSession = resolveActiveSessionForDate(data, dateKey);
  const sortedOccurrences = sortOccurrencesForExecution(dayOccurrences);
  const missedToday = dayOccurrences.filter((occurrence) => occurrence?.status === "missed").length;
  const doneToday = dayOccurrences.filter((occurrence) => occurrence?.status === "done").length;
  const plannedToday = dayOccurrences.filter((occurrence) => occurrence?.status === "planned").length;
  const remainingToday = plannedToday;
  const discipline7d = buildWindowStats(data, dateKey, 7);
  const discipline14d = buildWindowStats(data, dateKey, 14);

  return {
    requestId,
    trigger,
    selectedDateKey: dateKey,
    activeCategoryId: categoryId,
    category,
    goalsById,
    activeSession,
    dayOccurrences,
    sortedOccurrences,
    missedToday,
    doneToday,
    plannedToday,
    remainingToday,
    discipline7d,
    discipline14d,
    categoryStatus: categoryId ? buildCategoryStatus(data, categoryId, dateKey) : "EMPTY",
    quotaRemaining: quotaState.remaining,
  };
}

import {
  buildCategoryStatus,
  buildWindowStats,
  normalizeDateKey,
  resolveActiveSessionForDate,
  resolveCategory,
  resolveGoalMap,
  resolveOccurrencesForDate,
  safeArray,
  sortOccurrencesForExecution,
} from "./shared.js";

export function buildNowContext({ data, selectedDateKey, activeCategoryId, quotaState, requestId, trigger }) {
  const dateKey = normalizeDateKey(selectedDateKey);
  const category = resolveCategory(data, activeCategoryId);
  const categoryId = category?.id || null;
  const goalsById = resolveGoalMap(data);
  const dayOccurrences = resolveOccurrencesForDate(data, dateKey, categoryId);
  const activeSession = resolveActiveSessionForDate(data, dateKey);
  const sortedOccurrences = sortOccurrencesForExecution(dayOccurrences);
  const topOccurrence =
    sortedOccurrences.find((occurrence) => occurrence?.status === "in_progress") ||
    sortedOccurrences.find((occurrence) => occurrence?.status === "planned") ||
    null;
  const doneToday = dayOccurrences.filter((occurrence) => occurrence?.status === "done").length;
  const missedToday = dayOccurrences.filter((occurrence) => occurrence?.status === "missed").length;
  const remainingToday = dayOccurrences.filter((occurrence) => occurrence?.status === "planned").length;
  const recentHistory = safeArray(data?.sessionHistory).slice(-5);
  const discipline7d = buildWindowStats(data, dateKey, 7);

  return {
    requestId,
    trigger,
    selectedDateKey: dateKey,
    activeCategoryId: categoryId,
    category,
    goalsById,
    activeSession,
    topOccurrence,
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

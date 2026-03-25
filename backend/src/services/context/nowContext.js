import {
  buildCategoryStatus,
  resolveCategoryMap,
  resolveFocusOccurrenceForDate,
  resolveFocusOccurrenceSelectionForDate,
  resolvePlannedActionsForDate,
  resolveSessionSplitForDate,
  sortOccurrencesForExecution,
  buildWindowStats,
  normalizeDateKey,
  resolveCategory,
  resolveGoalMap,
  resolveOccurrencesForDate,
  safeArray,
} from "./shared.js";
import { computeCategoryScopedRecommendation } from "../../../../src/domain/todayCategoryCoherence.js";
import { resolveTodayOccurrenceStartPolicy } from "../../../../src/domain/todayIntervention.js";
import { derivePreferredBlockAlignment, normalizeUserAiProfile } from "../../../../src/domain/userAiProfile.js";

function buildOccurrenceById(data) {
  return new Map(safeArray(data?.occurrences).filter((occurrence) => occurrence?.id).map((occurrence) => [occurrence.id, occurrence]));
}

function resolveOccurrenceStartTime(occurrence) {
  const startTime =
    typeof occurrence?.start === "string" && occurrence.start
      ? occurrence.start
      : typeof occurrence?.slotKey === "string" && occurrence.slotKey
        ? occurrence.slotKey
        : "";
  return startTime || null;
}

function buildOccurrenceSummary({ occurrence, goalsById, categoriesById }) {
  if (!occurrence) return null;
  const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
  const category = goal?.categoryId ? categoriesById.get(goal.categoryId) || null : null;
  const startTime = resolveOccurrenceStartTime(occurrence);
  return {
    occurrenceId: occurrence.id || null,
    goalId: occurrence.goalId || null,
    title: goal?.title || occurrence.title || "Action",
    categoryName: category?.name || null,
    dateKey: occurrence.date || null,
    startTime,
    timeLabel: startTime ? `à ${startTime}` : null,
    durationMin: Number.isFinite(occurrence.durationMinutes) ? occurrence.durationMinutes : null,
    priority:
      typeof occurrence?.priority === "string"
        ? occurrence.priority
        : typeof occurrence?.priorityLevel === "string"
          ? occurrence.priorityLevel
          : null,
  };
}

function buildSessionSummary({ session, occurrenceById, goalsById, categoriesById }) {
  if (!session) return null;
  const occurrence =
    session.occurrenceId && occurrenceById.has(session.occurrenceId) ? occurrenceById.get(session.occurrenceId) : null;
  const goalId =
    occurrence?.goalId || (Array.isArray(session.habitIds) && session.habitIds.length ? session.habitIds[0] : null) || null;
  const goal = goalId ? goalsById.get(goalId) || null : null;
  const category = goal?.categoryId ? categoriesById.get(goal.categoryId) || null : null;
  const startTime = resolveOccurrenceStartTime(occurrence);
  return {
    sessionId: session.id || null,
    occurrenceId: session.occurrenceId || null,
    title: goal?.title || "Session active",
    categoryName: category?.name || null,
    dateKey: session.dateKey || occurrence?.date || null,
    timeLabel: startTime ? `à ${startTime}` : null,
    runtimePhase: session.runtimePhase || null,
  };
}

function buildDayLoadSummary(plannedActionsForActiveDate, userAiProfile) {
  const plannedList = safeArray(plannedActionsForActiveDate);
  const targetBudgetMinutes = Number(userAiProfile?.time_budget_daily_min) || 0;
  const totalPlannedMinutes = plannedList.reduce(
    (total, occurrence) => total + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0),
    0
  );
  return {
    plannedCount: plannedList.length,
    remainingCount: plannedList.length,
    totalPlannedMinutes,
    fixedCount: plannedList.filter((occurrence) => {
      const startTime = resolveOccurrenceStartTime(occurrence);
      return Boolean(startTime && occurrence?.noTime !== true && occurrence?.timeType !== "window");
    }).length,
    targetBudgetMinutes,
    loadRatio: targetBudgetMinutes > 0 ? Number((totalPlannedMinutes / targetBudgetMinutes).toFixed(2)) : null,
    preferredBlockAlignment: derivePreferredBlockAlignment({
      preferredTimeBlocks: userAiProfile?.preferred_time_blocks || [],
      occurrences: plannedList,
    }),
  };
}

function buildScheduleSignalSummary({
  activeDate,
  systemToday,
  openSessionOutsideActiveDate,
  openSessionOutsideSummary,
  focusOccurrenceForActiveDate,
  focusOccurrenceSummary,
}) {
  if (openSessionOutsideActiveDate) {
    return {
      type:
        openSessionOutsideActiveDate.dateKey && openSessionOutsideActiveDate.dateKey > activeDate
          ? "future_open_session"
          : "off_date_occurrence",
      sessionDateKey: openSessionOutsideActiveDate.dateKey || null,
      targetActionTitle: openSessionOutsideSummary?.title || focusOccurrenceSummary?.title || null,
      targetDateKey: openSessionOutsideActiveDate.dateKey || null,
      targetTimeLabel: openSessionOutsideSummary?.timeLabel || null,
    };
  }

  const focusStartPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate,
    systemToday,
    occurrenceDate: focusOccurrenceForActiveDate?.date || "",
  });
  if (focusOccurrenceForActiveDate && focusStartPolicy.requiresReschedule) {
    return {
      type: "off_date_occurrence",
      sessionDateKey: null,
      targetActionTitle: focusOccurrenceSummary?.title || null,
      targetDateKey: focusOccurrenceSummary?.dateKey || null,
      targetTimeLabel: focusOccurrenceSummary?.timeLabel || null,
    };
  }

  return {
    type: "none",
    sessionDateKey: null,
    targetActionTitle: null,
    targetDateKey: null,
    targetTimeLabel: null,
  };
}

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
  const userAiProfile = normalizeUserAiProfile(data?.user_ai_profile);
  const category = resolveCategory(data, activeCategoryId);
  const categoryId = category?.id || null;
  const goalsById = resolveGoalMap(data);
  const categoriesById = resolveCategoryMap(data);
  const occurrenceById = buildOccurrenceById(data);
  const dayOccurrences = resolveOccurrencesForDate(data, dateKey, null);
  const plannedActionsForActiveDate = resolvePlannedActionsForDate(data, dateKey, null);
  const { activeSessionForActiveDate, openSessionOutsideActiveDate, futureSessions } = resolveSessionSplitForDate(
    data,
    dateKey
  );
  const canonicalFocusSelection = resolveFocusOccurrenceSelectionForDate({
    dateKey,
    now,
    occurrences: plannedActionsForActiveDate,
    preferredTimeBlocks: userAiProfile.preferred_time_blocks,
  });
  const canonicalFocusOccurrenceForActiveDate = canonicalFocusSelection.occurrence || resolveFocusOccurrenceForDate({
    dateKey,
    now,
    occurrences: plannedActionsForActiveDate,
    preferredTimeBlocks: userAiProfile.preferred_time_blocks,
  });
  const categoryCoherence = computeCategoryScopedRecommendation({
    activeDate: dateKey,
    systemToday,
    activeCategoryId: categoryId,
    categories: safeArray(data?.categories),
    goals: safeArray(data?.goals),
    occurrences: safeArray(data?.occurrences),
    plannedActionsForActiveDate,
    preferredTimeBlocks: userAiProfile.preferred_time_blocks,
  });
  const focusOccurrenceForActiveDate = categoryCoherence.recommendedOccurrence || null;
  const focusSelectionReason = focusOccurrenceForActiveDate
    ? focusOccurrenceForActiveDate?.id === canonicalFocusOccurrenceForActiveDate?.id
      ? canonicalFocusSelection.reason || null
      : "category_scoped"
    : null;
  const doneToday = dayOccurrences.filter((occurrence) => occurrence?.status === "done").length;
  const missedToday = dayOccurrences.filter((occurrence) => occurrence?.status === "missed").length;
  const remainingToday = plannedActionsForActiveDate.length;
  const recentHistory = safeArray(data?.sessionHistory).slice(-5);
  const discipline7d = buildWindowStats(data, dateKey, 7);
  const focusOccurrenceSummary = buildOccurrenceSummary({
    occurrence: focusOccurrenceForActiveDate,
    goalsById,
    categoriesById,
  });
  const alternativeOccurrenceSummaries = sortOccurrencesForExecution(plannedActionsForActiveDate)
    .filter((occurrence) => occurrence?.id !== focusOccurrenceForActiveDate?.id)
    .slice(0, 2)
    .map((occurrence) =>
      buildOccurrenceSummary({
        occurrence,
        goalsById,
        categoriesById,
      })
    )
    .filter(Boolean);
  const activeSessionSummary = buildSessionSummary({
    session: activeSessionForActiveDate,
    occurrenceById,
    goalsById,
    categoriesById,
  });
  const openSessionOutsideSummary = buildSessionSummary({
    session: openSessionOutsideActiveDate,
    occurrenceById,
    goalsById,
    categoriesById,
  });
  const dayLoadSummary = buildDayLoadSummary(plannedActionsForActiveDate, userAiProfile);
  const scheduleSignalSummary = buildScheduleSignalSummary({
    activeDate: dateKey,
    systemToday,
    openSessionOutsideActiveDate,
    openSessionOutsideSummary,
    focusOccurrenceForActiveDate,
    focusOccurrenceSummary,
  });
  const gapSummary = {
    ...categoryCoherence,
    lowLoadToday:
      Boolean(categoryCoherence?.hasGapToday) && Number(dayLoadSummary?.totalPlannedMinutes || 0) < 30,
    emptyActiveCategory: categoryCoherence?.gapReason === "empty_active_category",
    activeDate: dateKey,
  };

  return {
    requestId,
    trigger,
    activeDate: dateKey,
    systemToday,
    isToday: Boolean(dateKey && systemToday && dateKey === systemToday),
    selectedDateKey: dateKey,
    activeCategoryId: categoryId,
    category,
    userAiProfile,
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
    activeSessionSummary,
    focusOccurrenceSummary,
    alternativeOccurrenceSummaries,
    focusSelectionReason,
    dayLoadSummary,
    scheduleSignalSummary,
    categoryCoherence,
    gapSummary,
    doneToday,
    missedToday,
    remainingToday,
    discipline7d,
    categoryStatus: categoryId ? buildCategoryStatus(data, categoryId, dateKey) : "EMPTY",
    quotaRemaining: quotaState.remaining,
  };
}

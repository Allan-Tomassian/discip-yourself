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
import { resolveTodayOccurrenceStartPolicy } from "../../../../src/domain/todayIntervention.js";

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

function buildDayLoadSummary(plannedActionsForActiveDate) {
  const plannedList = safeArray(plannedActionsForActiveDate);
  return {
    plannedCount: plannedList.length,
    remainingCount: plannedList.length,
    totalPlannedMinutes: plannedList.reduce(
      (total, occurrence) => total + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0),
      0
    ),
    fixedCount: plannedList.filter((occurrence) => {
      const startTime = resolveOccurrenceStartTime(occurrence);
      return Boolean(startTime && occurrence?.noTime !== true && occurrence?.timeType !== "window");
    }).length,
  };
}

function isExecutableGoal(goal) {
  if (!goal || typeof goal !== "object" || !goal.id || !goal.categoryId) return false;
  const status = typeof goal.status === "string" ? goal.status.toLowerCase() : "";
  if (status === "archived" || status === "deleted" || status === "removed" || status === "done") return false;
  return goal?.type === "PROCESS" || goal?.planType === "ACTION" || goal?.planType === "ONE_OFF";
}

function buildGoalActivityIndex(data) {
  const index = new Map();
  for (const occurrence of safeArray(data?.occurrences)) {
    const goalId = typeof occurrence?.goalId === "string" ? occurrence.goalId : "";
    const dateKey = normalizeDateKey(occurrence?.date);
    if (!goalId || !dateKey) continue;
    const current = index.get(goalId) || {
      lastPlannedDateKey: null,
      durationMin: null,
    };
    if (!current.lastPlannedDateKey || dateKey > current.lastPlannedDateKey) {
      current.lastPlannedDateKey = dateKey;
    }
    if (Number.isFinite(occurrence?.durationMinutes)) {
      current.durationMin = occurrence.durationMinutes;
    }
    index.set(goalId, current);
  }
  return index;
}

function compareCandidateActions(left, right, activeCategoryId) {
  const leftHasHistory = left?.lastPlannedDateKey ? 0 : 1;
  const rightHasHistory = right?.lastPlannedDateKey ? 0 : 1;
  if (leftHasHistory !== rightHasHistory) return leftHasHistory - rightHasHistory;

  const leftDate = left?.lastPlannedDateKey || "";
  const rightDate = right?.lastPlannedDateKey || "";
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function buildGapSummary({
  data,
  activeDate,
  systemToday,
  activeCategoryId,
  categoriesById,
  plannedActionsForActiveDate,
  plannedActionsForActiveCategory,
  focusOccurrenceForActiveDate,
  dayLoadSummary,
}) {
  const isToday = Boolean(activeDate && systemToday && activeDate === systemToday);
  if (!isToday) {
    return {
      hasGapToday: false,
      emptyActiveCategory: false,
      lowLoadToday: false,
      gapReason: "none",
      selectionScope: "none",
      activeCategoryCandidateCount: 0,
      crossCategoryCandidateCount: 0,
      candidateActionSummaries: [],
    };
  }
  const emptyDay = plannedActionsForActiveDate.length === 0 && !focusOccurrenceForActiveDate;
  const emptyActiveCategory =
    Boolean(activeCategoryId) &&
    plannedActionsForActiveDate.length > 0 &&
    plannedActionsForActiveCategory.length === 0;
  const lowLoadToday =
    plannedActionsForActiveDate.length > 0 && Number(dayLoadSummary?.totalPlannedMinutes || 0) < 30;
  const gapReason = emptyDay
    ? "empty_day"
    : emptyActiveCategory
      ? "empty_active_category"
      : lowLoadToday
        ? "low_load_day"
        : "none";
  const hasGapToday = gapReason !== "none";
  const plannedGoalIdsForActiveDate = new Set(plannedActionsForActiveDate.map((occurrence) => occurrence?.goalId).filter(Boolean));
  const goalActivityIndex = buildGoalActivityIndex(data);
  const allCandidateSummaries = safeArray(data?.goals)
    .filter(isExecutableGoal)
    .filter((goal) => !plannedGoalIdsForActiveDate.has(goal.id))
    .map((goal) => {
      const category = categoriesById.get(goal.categoryId) || null;
      const activity = goalActivityIndex.get(goal.id) || null;
      return {
        actionId: goal.id,
        categoryId: goal.categoryId,
        title: goal.title || "Action",
        categoryName: category?.name || null,
        durationMin: Number.isFinite(goal.sessionMinutes) ? goal.sessionMinutes : activity?.durationMin || null,
        lastPlannedDateKey: activity?.lastPlannedDateKey || null,
      };
    })
    .sort((left, right) => compareCandidateActions(left, right, activeCategoryId));
  const activeCategoryCandidates = allCandidateSummaries.filter(
    (candidate) => candidate?.categoryId && candidate.categoryId === activeCategoryId
  );
  const crossCategoryCandidates = allCandidateSummaries.filter(
    (candidate) => !candidate?.categoryId || candidate.categoryId !== activeCategoryId
  );
  const selectedPool = activeCategoryCandidates.length > 0 ? activeCategoryCandidates : crossCategoryCandidates;
  const selectionScope = selectedPool === activeCategoryCandidates && activeCategoryCandidates.length > 0
    ? "active_category"
    : selectedPool.length > 0
      ? "cross_category_fallback"
      : "none";
  const candidateActionSummaries = selectedPool
    .slice(0, 2)
    .map(({ categoryId, ...summary }) => summary);

  return {
    hasGapToday,
    emptyActiveCategory: Boolean(activeCategoryId) && activeCategoryCandidates.length === 0,
    lowLoadToday,
    gapReason,
    selectionScope,
    activeCategoryCandidateCount: activeCategoryCandidates.length,
    crossCategoryCandidateCount: crossCategoryCandidates.length,
    candidateActionSummaries,
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
  const category = resolveCategory(data, activeCategoryId);
  const categoryId = category?.id || null;
  const goalsById = resolveGoalMap(data);
  const categoriesById = resolveCategoryMap(data);
  const occurrenceById = buildOccurrenceById(data);
  const dayOccurrences = resolveOccurrencesForDate(data, dateKey, null);
  const plannedActionsForActiveDate = resolvePlannedActionsForDate(data, dateKey, null);
  const plannedActionsForActiveCategory = categoryId ? resolvePlannedActionsForDate(data, dateKey, categoryId) : plannedActionsForActiveDate;
  const { activeSessionForActiveDate, openSessionOutsideActiveDate, futureSessions } = resolveSessionSplitForDate(
    data,
    dateKey
  );
  const focusSelection = resolveFocusOccurrenceSelectionForDate({
    dateKey,
    now,
    occurrences: plannedActionsForActiveDate,
  });
  const focusOccurrenceForActiveDate = focusSelection.occurrence || resolveFocusOccurrenceForDate({
    dateKey,
    now,
    occurrences: plannedActionsForActiveDate,
  });
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
  const dayLoadSummary = buildDayLoadSummary(plannedActionsForActiveDate);
  const scheduleSignalSummary = buildScheduleSignalSummary({
    activeDate: dateKey,
    systemToday,
    openSessionOutsideActiveDate,
    openSessionOutsideSummary,
    focusOccurrenceForActiveDate,
    focusOccurrenceSummary,
  });
  const gapSummary = buildGapSummary({
    data,
    activeDate: dateKey,
    systemToday,
    activeCategoryId: categoryId,
    categoriesById,
    plannedActionsForActiveDate,
    plannedActionsForActiveCategory,
    focusOccurrenceForActiveDate,
    dayLoadSummary,
  });

  return {
    requestId,
    trigger,
    activeDate: dateKey,
    systemToday,
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
    activeSessionSummary,
    focusOccurrenceSummary,
    alternativeOccurrenceSummaries,
    focusSelectionReason: focusSelection.reason || null,
    dayLoadSummary,
    scheduleSignalSummary,
    gapSummary,
    doneToday,
    missedToday,
    remainingToday,
    discipline7d,
    categoryStatus: categoryId ? buildCategoryStatus(data, categoryId, dateKey) : "EMPTY",
    quotaRemaining: quotaState.remaining,
  };
}

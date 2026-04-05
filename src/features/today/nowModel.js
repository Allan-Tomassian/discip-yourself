import { getAlternativeCandidates } from "../../core/focus/focusSelector";
import { resolveTodayOccurrenceStartPolicy } from "../../domain/todayIntervention";
import { resolveGoalType } from "../../domain/goalType";
import { isPrimaryCategory } from "../../logic/priority";
import { deriveTodayContextModel } from "./todayContextModel";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function sortProcessGoals(goals) {
  return safeArray(goals).slice().sort((a, b) => {
    const ao = Number.isFinite(a?.order) ? a.order : 0;
    const bo = Number.isFinite(b?.order) ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return String(a?.title || "").localeCompare(String(b?.title || ""));
  });
}

export function resolveTodayFocusCategory({ categories, goals, selectedCategoryId }) {
  const categoryList = safeArray(categories);
  const goalList = safeArray(goals);
  if (!categoryList.length) return null;

  const selected = categoryList.find((category) => category?.id === selectedCategoryId) || null;
  if (selected) return selected;

  const primary = categoryList.find((category) => isPrimaryCategory(category)) || null;
  if (primary) return primary;

  const withAction = categoryList.find((category) =>
    goalList.some((goal) => goal?.categoryId === category.id && resolveGoalType(goal) === "PROCESS")
  );
  if (withAction) return withAction;

  return categoryList[0] || null;
}

export function deriveTodayNowModel({
  categories,
  goals,
  selectedCategoryId,
  rawActiveSession,
  selectedDateKey,
  focusOverride,
  plannedOccurrencesForDay,
  now = new Date(),
}) {
  const categoryList = safeArray(categories);
  const goalList = safeArray(goals);
  const todayContext = deriveTodayContextModel({
    selectedDateKey,
    rawActiveSession,
    plannedOccurrencesForDay,
    now,
  });
  const plannedList = todayContext.plannedActionsForActiveDate;

  const focusCategory = resolveTodayFocusCategory({
    categories: categoryList,
    goals: goalList,
    selectedCategoryId,
  });

  const executableActions = sortProcessGoals(
    !focusCategory?.id
      ? []
      : goalList.filter((goal) => goal?.categoryId === focusCategory.id && resolveGoalType(goal) === "PROCESS")
  );
  const activeHabits = executableActions.filter((goal) => safeString(goal?.status) === "active");
  const ensureProcessIds = executableActions.map((goal) => goal?.id).filter(Boolean);

  const activeSession = todayContext.activeSessionForActiveDate;
  const sessionForDay = todayContext.activeSessionForActiveDate;
  const sessionHabit = (() => {
    if (!sessionForDay?.habitIds?.length) return null;
    const firstId = sessionForDay.habitIds[0];
    return firstId ? goalList.find((goal) => goal.id === firstId) || null : null;
  })();

  const focusBaseOccurrence = todayContext.focusOccurrenceForActiveDate;
  const focusOverrideOccurrence =
    focusOverride?.dateKey === selectedDateKey
      ? plannedList.find((occurrence) => occurrence?.id === focusOverride?.occurrenceId) || null
      : null;
  const focusOccurrence = focusOverrideOccurrence || focusBaseOccurrence;
  const sessionCategory =
    sessionHabit?.categoryId
      ? categoryList.find((category) => category?.id === sessionHabit.categoryId) || null
      : null;
  const focusOccurrenceCategory = (() => {
    const goalId = typeof focusOccurrence?.goalId === "string" ? focusOccurrence.goalId : "";
    const goal = goalId ? goalList.find((candidate) => candidate?.id === goalId) || null : null;
    return goal?.categoryId ? categoryList.find((category) => category?.id === goal.categoryId) || null : null;
  })();
  const resolvedFocusCategory = sessionCategory || focusOccurrenceCategory || focusCategory;
  const focusStartPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate: todayContext.activeDate,
    systemToday: todayContext.systemToday,
    occurrenceDate: focusOccurrence?.date || "",
  });
  const isFocusOverride = Boolean(
    focusOverrideOccurrence && focusBaseOccurrence && focusOverrideOccurrence.id !== focusBaseOccurrence.id
  );
  const alternativeCandidates = getAlternativeCandidates({
    dateKey: selectedDateKey,
    now,
    occurrences: plannedList,
    limit: 4,
    excludeId: focusOccurrence?.id || null,
  });
  const canStartDirectly = Boolean(focusOccurrence) && focusStartPolicy.canStartDirectly;
  const fallbackReason = (() => {
    if (focusOccurrence) return "planned_occurrence";
    if (sessionForDay?.occurrenceId) return "session_active";
    if (ensureProcessIds.length) return "no_planned_occurrence";
    if (focusCategory?.id) return "no_executable_action";
    return "no_category";
  })();
  const startPayload = canStartDirectly
    ? {
        occurrenceId: focusOccurrence.id || null,
        dateKey: focusOccurrence.date || selectedDateKey,
        habitIds: focusOccurrence.goalId ? [focusOccurrence.goalId] : [],
      }
    : null;

  return {
    activeDate: todayContext.activeDate,
    systemToday: todayContext.systemToday,
    isToday: todayContext.isToday,
    datePhase: todayContext.datePhase,
    focusCategory: resolvedFocusCategory,
    selectedCategoryId: resolvedFocusCategory?.id || null,
    activeHabits,
    ensureProcessIds,
    activeSessionForActiveDate: todayContext.activeSessionForActiveDate,
    openSessionOutsideActiveDate: todayContext.openSessionOutsideActiveDate,
    futureSessions: todayContext.futureSessions,
    plannedActionsForActiveDate: todayContext.plannedActionsForActiveDate,
    focusOccurrenceForActiveDate: todayContext.focusOccurrenceForActiveDate,
    activeSession,
    sessionForDay,
    sessionHabit,
    focusBaseOccurrence,
    focusOverrideOccurrence,
    focusOccurrence,
    isFocusOverride,
    alternativeCandidates,
    canStartDirectly,
    canStart: canStartDirectly,
    requiresReschedule: Boolean(focusOccurrence) && focusStartPolicy.requiresReschedule,
    fallbackReason,
    startPayload,
  };
}

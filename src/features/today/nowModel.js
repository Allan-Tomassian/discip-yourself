import { getAlternativeCandidates, getNextPlannedOccurrence } from "../../core/focus/focusSelector";
import { resolveGoalType } from "../../domain/goalType";
import { normalizeActiveSessionForUI } from "../../logic/compat";
import { splitProcessByLink } from "../../logic/linking";
import { isPrimaryCategory, isPrimaryGoal } from "../../logic/priority";

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

  const withOutcome = categoryList.find((category) =>
    goalList.some((goal) => goal?.categoryId === category.id && resolveGoalType(goal) === "OUTCOME")
  );
  return withOutcome || categoryList[0] || null;
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
  const plannedList = safeArray(plannedOccurrencesForDay);

  const focusCategory = resolveTodayFocusCategory({
    categories: categoryList,
    goals: goalList,
    selectedCategoryId,
  });

  const outcomeGoals = !focusCategory?.id
    ? []
    : goalList.filter((goal) => goal?.categoryId === focusCategory.id && resolveGoalType(goal) === "OUTCOME");

  const mainGoalId = typeof focusCategory?.mainGoalId === "string" ? focusCategory.mainGoalId : null;
  const selectedGoal = (() => {
    if (!focusCategory?.id || !outcomeGoals.length) return null;
    if (mainGoalId) {
      const main = outcomeGoals.find((goal) => goal.id === mainGoalId) || null;
      if (main) return main;
    }
    const primaryGoal = outcomeGoals.find((goal) => isPrimaryGoal(goal)) || null;
    return primaryGoal || outcomeGoals[0] || null;
  })();

  const processGoals = sortProcessGoals(
    !focusCategory?.id
      ? []
      : goalList.filter((goal) => goal?.categoryId === focusCategory.id && resolveGoalType(goal) === "PROCESS")
  );

  const { linked: linkedHabits, unlinked: unlinkedHabits } = selectedGoal?.id
    ? splitProcessByLink(processGoals, selectedGoal.id)
    : { linked: processGoals, unlinked: [] };

  const scopedHabits = linkedHabits.length ? linkedHabits : processGoals;
  const activeHabits = scopedHabits.filter((goal) => safeString(goal?.status) === "active");
  const ensureProcessIds = scopedHabits.map((goal) => goal?.id).filter(Boolean);

  const activeSession = normalizeActiveSessionForUI(rawActiveSession);
  const sessionForDay = (() => {
    if (!activeSession) return null;
    const sessionDateKey = activeSession.dateKey || activeSession.date;
    return sessionDateKey === selectedDateKey ? activeSession : null;
  })();
  const sessionHabit = (() => {
    if (!sessionForDay?.habitIds?.length) return null;
    const firstId = sessionForDay.habitIds[0];
    return firstId ? goalList.find((goal) => goal.id === firstId) || null : null;
  })();

  const focusBaseOccurrence = getNextPlannedOccurrence({
    dateKey: selectedDateKey,
    now,
    occurrences: plannedList,
  });
  const focusOverrideOccurrence =
    focusOverride?.dateKey === selectedDateKey
      ? plannedList.find((occurrence) => occurrence?.id === focusOverride?.occurrenceId) || null
      : null;
  const focusOccurrence = focusOverrideOccurrence || focusBaseOccurrence;
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

  return {
    focusCategory,
    selectedGoal,
    processGoals,
    linkedHabits,
    unlinkedHabits,
    selectableHabits: scopedHabits,
    activeHabits,
    ensureProcessIds,
    activeSession,
    sessionForDay,
    sessionHabit,
    focusBaseOccurrence,
    focusOverrideOccurrence,
    focusOccurrence,
    isFocusOverride,
    alternativeCandidates,
  };
}

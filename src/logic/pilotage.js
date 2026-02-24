import { addDays, startOfWeekKey, todayKey } from "../utils/dates";
import { resolveGoalType } from "../domain/goalType";
import {
  isCompletedOccurrenceStatus,
  isExcludedFromExpectedOccurrenceStatus,
  normalizeOccurrenceStatus,
} from "./occurrenceStatus";

function buildWeekKeys(nowDate) {
  const weekStartKey = startOfWeekKey(nowDate);
  const weekStartDate = new Date(`${weekStartKey}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => todayKey(addDays(weekStartDate, i)));
}

function isGoalActive(goal) {
  const st = typeof goal?.status === "string" ? goal.status : "";
  return st !== "done" && st !== "invalid" && st !== "abandoned";
}

function collectActiveOutcomeIds(goals) {
  const set = new Set();
  for (const g of goals) {
    if (!g) continue;
    if (resolveGoalType(g) !== "PROCESS") continue;
    const rawOutcome = typeof g.outcomeId === "string" ? g.outcomeId.trim() : "";
    const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
    const id = rawOutcome || rawParent;
    if (id) set.add(id);
  }
  return set;
}

export function getCategoryCounts(data, categoryId) {
  if (!categoryId) return { outcomesCount: 0, processCount: 0 };
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  let outcomesCount = 0;
  let processCount = 0;
  for (const g of goals) {
    if (!g || g.categoryId !== categoryId) continue;
    const type = resolveGoalType(g);
    if (type === "OUTCOME") outcomesCount += 1;
    if (type === "PROCESS") processCount += 1;
  }
  return { outcomesCount, processCount };
}

export function getCategoryPilotageCounts(data, categoryId) {
  if (!categoryId) return { activeOutcomesCount: 0, processCount: 0 };
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const activeOutcomeIds = collectActiveOutcomeIds(goals);
  let activeOutcomesCount = 0;
  let processCount = 0;
  for (const g of goals) {
    if (!g || g.categoryId !== categoryId) continue;
    const type = resolveGoalType(g);
    if (type === "PROCESS") processCount += 1;
    if (type === "OUTCOME" && activeOutcomeIds.has(g.id)) activeOutcomesCount += 1;
  }
  return { activeOutcomesCount, processCount };
}

export function getCategoryStatus(data, categoryId, nowDate = new Date()) {
  const { activeOutcomesCount, processCount } = getCategoryPilotageCounts(data, categoryId);
  if (activeOutcomesCount === 0 && processCount === 0) return "EMPTY";
  if (processCount === 0) return "EMPTY";

  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processGoals = goals.filter((g) => g && g.categoryId === categoryId && resolveGoalType(g) === "PROCESS");
  if (!processGoals.length) return "ACTIVE";

  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const today = todayKey(nowDate);
  const weekKeys = buildWeekKeys(nowDate);
  const weekSet = new Set(weekKeys);
  const processIds = new Set(processGoals.map((g) => g.id));

  let hasFutureOccurrences = false;
  const occCountByGoal = new Map();
  const occPlannedByGoal = new Map();
  const occDoneByGoal = new Map();

  if (occurrences.length) {
    for (const occ of occurrences) {
      if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
      const dateKey = typeof occ.date === "string" ? occ.date : "";
      const status = normalizeOccurrenceStatus(occ.status);
      if (dateKey && dateKey > today && !isExcludedFromExpectedOccurrenceStatus(status)) hasFutureOccurrences = true;
      if (dateKey && weekSet.has(dateKey)) {
        occCountByGoal.set(occ.goalId, (occCountByGoal.get(occ.goalId) || 0) + 1);
        if (isCompletedOccurrenceStatus(status)) {
          occDoneByGoal.set(occ.goalId, (occDoneByGoal.get(occ.goalId) || 0) + 1);
        } else if (!isExcludedFromExpectedOccurrenceStatus(status)) {
          occPlannedByGoal.set(occ.goalId, (occPlannedByGoal.get(occ.goalId) || 0) + 1);
        }
      }
    }
  }

  let hasPlannedData = false;
  let allPlannedMet = true;
  let hasActivePlannedGoal = false;

  for (const goal of processGoals) {
    const goalId = goal.id;
    const occCount = occCountByGoal.get(goalId) || 0;
    const hasOccurrencePlan = occCount > 0;
    const plannedAvailable = hasOccurrencePlan;
    if (plannedAvailable) hasPlannedData = true;

    if (!plannedAvailable) {
      if (isGoalActive(goal) && hasOccurrencePlan) {
        hasActivePlannedGoal = true;
      }
      continue;
    }

    if (isGoalActive(goal)) hasActivePlannedGoal = true;

    const plannedCount = occPlannedByGoal.get(goalId) || 0;
    const doneCount = occDoneByGoal.get(goalId) || 0;
    if (doneCount < plannedCount) allPlannedMet = false;
  }

  if (occurrences.length && hasFutureOccurrences) return "ACTIVE";
  if (hasPlannedData) {
    return allPlannedMet ? "DONE" : "ACTIVE";
  }
  return hasActivePlannedGoal ? "ACTIVE" : "DONE";
}

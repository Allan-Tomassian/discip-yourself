import { addDays } from "../../utils/dates";
import { normalizeLocalDateKey, toLocalDateKey } from "../../utils/dateKey";
import { resolveGoalType } from "../../domain/goalType";
import { computeWindowStats } from "../../logic/progressionModel";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function deriveTodayProgressModel({
  activeHabits,
  doneHabitIds,
  goals,
  occurrences,
  microChecks,
  localTodayKey,
  safeData,
}) {
  const activeHabitList = safeArray(activeHabits);
  const goalList = safeArray(goals);
  const occurrenceList = safeArray(occurrences);
  const doneIds = doneHabitIds instanceof Set ? doneHabitIds : new Set();

  const activeIds = new Set(activeHabitList.map((habit) => habit.id));
  const doneActionCount = Array.from(activeIds).reduce(
    (sum, id) => sum + (doneIds.has(id) ? 1 : 0),
    0
  );
  const plannedActionCount = activeHabitList.length;
  const coreProgress = {
    total: plannedActionCount,
    done: doneActionCount,
    ratio: plannedActionCount ? doneActionCount / plannedActionCount : 0,
  };

  const now = new Date();
  const yesterdayKey = toLocalDateKey(addDays(now, -1));

  const historyKeys = [];
  for (const occ of occurrenceList) {
    if (!occ || typeof occ.date !== "string") continue;
    if (occ.date >= localTodayKey) continue;
    historyKeys.push(occ.date);
  }
  for (const [dateKey] of Object.entries(microChecks || {})) {
    const key = normalizeLocalDateKey(dateKey);
    if (!key || key >= localTodayKey) continue;
    historyKeys.push(key);
  }
  for (const goal of goalList) {
    if (resolveGoalType(goal) !== "OUTCOME") continue;
    if (goal?.status !== "done") continue;
    const key = normalizeLocalDateKey(goal?.completedAt);
    if (!key || key >= localTodayKey) continue;
    historyKeys.push(key);
  }

  const oldestHistoryKey = historyKeys.length ? historyKeys.sort()[0] : null;
  const disciplineWindow =
    oldestHistoryKey && oldestHistoryKey <= yesterdayKey
      ? computeWindowStats(safeData, oldestHistoryKey, yesterdayKey, { includeMicroContribution: true })
      : null;
  const disciplineScore = disciplineWindow?.discipline?.score ?? 0;
  const disciplineRatio = disciplineWindow?.discipline?.rate ?? 0;

  const hasAnyOccurrences = occurrenceList.some((occ) => occ && typeof occ.status === "string");
  const hasAnyMicro = Object.keys(microChecks || {}).length > 0;
  const hasAnyDoneOutcome = goalList.some((goal) => resolveGoalType(goal) === "OUTCOME" && goal.status === "done");
  const hasAnyHistory = hasAnyOccurrences || hasAnyMicro || hasAnyDoneOutcome;

  if (!hasAnyHistory) {
    const outcomesTotal = goalList.filter((goal) => resolveGoalType(goal) === "OUTCOME").length;
    return {
      coreProgress,
      habitsDoneCount: coreProgress.done,
      disciplineSummary: {
        score: 100,
        ratio: 1,
        habit14: { done: 0, planned: 0, ratio: 1, keptDays: 0 },
        habit90: { done: 0, planned: 0, ratio: 1, keptDays: 0 },
        microDone14: 0,
        microMax14: 0,
        microRatio14: 1,
        outcomesDone90: 0,
        outcomesTotal,
        reliabilityRatio: 1,
        habitDaysKept14: 0,
      },
    };
  }

  const processAll = goalList.filter((goal) => resolveGoalType(goal) === "PROCESS" && goal.status === "active");
  const processIds = processAll.map((goal) => goal.id);
  const plannedPerDay = processIds.length;

  function getDoneIdsForDate(key) {
    const ids = new Set();
    for (const occ of occurrenceList) {
      if (!occ || occ.status !== "done") continue;
      if (occ.date !== key) continue;
      if (processIds.includes(occ.goalId)) ids.add(occ.goalId);
    }
    return ids;
  }

  function countDoneForWindow(days) {
    let done = 0;
    let keptDays = 0;
    for (let i = 0; i < days; i += 1) {
      const key = toLocalDateKey(addDays(now, -i));
      const doneIdsForDate = getDoneIdsForDate(key);
      let kept = true;
      for (const id of processIds) if (doneIdsForDate.has(id)) done += 1;
      if (processIds.length) {
        for (const id of processIds) {
          if (!doneIdsForDate.has(id)) {
            kept = false;
            break;
          }
        }
        if (kept) keptDays += 1;
      }
    }
    const planned = plannedPerDay * days;
    return { done, planned, ratio: planned ? done / planned : 0, keptDays };
  }

  const habit14 = countDoneForWindow(14);
  const habit90 = countDoneForWindow(90);

  let microDone14 = 0;
  for (let i = 0; i < 14; i += 1) {
    const key = toLocalDateKey(addDays(now, -i));
    const micro = microChecks?.[key] && typeof microChecks[key] === "object" ? microChecks[key] : {};
    microDone14 += Math.min(3, Object.keys(micro || {}).length);
  }
  const microMax14 = 14 * 3;
  const microRatio14 = microMax14 ? microDone14 / microMax14 : 0;

  const outcomes = goalList.filter((goal) => resolveGoalType(goal) === "OUTCOME");
  const cutoff = addDays(now, -89).getTime();
  const outcomesDone90 = outcomes.filter((goal) => {
    if (goal.status !== "done") return false;
    const key = typeof goal.completedAt === "string" ? goal.completedAt : "";
    if (!key) return false;
    const ts = new Date(`${key}T12:00:00`).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
  const outcomeRatio90 = outcomes.length ? outcomesDone90 / outcomes.length : 0;
  const reliabilityRatio = outcomes.length ? (habit90.ratio + outcomeRatio90) / 2 : habit90.ratio;

  return {
    coreProgress,
    habitsDoneCount: coreProgress.done,
    disciplineSummary: {
      score: disciplineScore,
      ratio: disciplineRatio,
      habit14,
      habit90,
      microDone14,
      microMax14,
      microRatio14,
      outcomesDone90,
      outcomesTotal: outcomes.length,
      reliabilityRatio,
      habitDaysKept14: habit14.keptDays,
    },
  };
}

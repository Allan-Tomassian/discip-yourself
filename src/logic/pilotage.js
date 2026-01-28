import { addDays, startOfWeekKey, todayKey } from "../utils/dates";
import { resolveGoalType } from "../domain/goalType";

function buildWeekKeys(nowDate) {
  const weekStartKey = startOfWeekKey(nowDate);
  const weekStartDate = new Date(`${weekStartKey}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => todayKey(addDays(weekStartDate, i)));
}

function collectDoneCountByDate(data, dateKeys, processIds) {
  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const keys = Array.isArray(dateKeys) ? dateKeys : [];
  const dateSet = new Set(keys);
  const pidSet = processIds instanceof Set ? processIds : null;

  const map = new Map();
  for (const key of keys) map.set(key, 0);

  for (const occ of occurrences) {
    if (!occ || occ.status !== "done") continue;
    const dateKey = typeof occ.date === "string" ? occ.date : "";
    if (!dateSet.has(dateKey)) continue;
    if (pidSet) {
      const goalId = typeof occ.goalId === "string" ? occ.goalId : "";
      if (!goalId || !pidSet.has(goalId)) continue;
    }
    map.set(dateKey, (map.get(dateKey) || 0) + 1);
  }

  return map;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isOccIgnoredForExpected(status) {
  // ignored = does not count in expected workload
  return status === "canceled" || status === "skipped";
}

function isOccExpected(status) {
  // expected = counts toward workload (either planned or done)
  return !isOccIgnoredForExpected(status);
}

function isOccDone(status) {
  return status === "done";
}

export function computeDisciplineScore(occurrences, todayKeyValue) {
  const list = Array.isArray(occurrences) ? occurrences : [];
  const todayKeyStr = typeof todayKeyValue === "string" ? todayKeyValue : "";
  // Backward-compat: previous behavior considered *all* past occurrences.
  // We keep it, but use the same semantics (skip/cancel not counted as expected).
  const expected = list.filter((occ) => {
    if (!occ || typeof occ.date !== "string") return false;
    if (todayKeyStr && !(occ.date < todayKeyStr)) return false;
    const st = occ.status || "planned";
    return isOccExpected(st);
  }).length;

  if (!expected) return { score: 100, ratio: 1, expected: 0, missed: 0, done: 0 };

  const done = list.filter((occ) => {
    if (!occ || typeof occ.date !== "string") return false;
    if (todayKeyStr && !(occ.date < todayKeyStr)) return false;
    const st = occ.status || "planned";
    return isOccDone(st);
  }).length;

  const missed = Math.max(0, expected - done);
  const score = clamp(Math.round(100 * (1 - missed / expected)), 0, 100);
  return { score, ratio: score / 100, expected, missed, done };
}

export function computeDisciplineScoreWindow(occurrences, windowKeys, todayKeyValue) {
  const list = Array.isArray(occurrences) ? occurrences : [];
  const keys = Array.isArray(windowKeys) ? windowKeys : [];
  const todayKeyStr = typeof todayKeyValue === "string" ? todayKeyValue : "";
  const keySet = new Set(keys);

  let expected = 0;
  let done = 0;

  for (const occ of list) {
    if (!occ || typeof occ.date !== "string") continue;
    const dateKey = occ.date;
    if (!keySet.has(dateKey)) continue;
    // Discipline window should ignore today+future (only penalize once the day has passed).
    if (todayKeyStr && !(dateKey < todayKeyStr)) continue;

    const st = occ.status || "planned";
    if (!isOccExpected(st)) continue;
    expected += 1;
    if (isOccDone(st)) done += 1;
  }

  if (!expected) return { score: 100, ratio: 1, expected: 0, missed: 0, done: 0 };
  const missed = Math.max(0, expected - done);
  const score = clamp(Math.round(100 * (1 - missed / expected)), 0, 100);
  return { score, ratio: score / 100, expected, missed, done };
}

function runDisciplineSanityChecks() {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return;
  const today = "2026-01-27";
  const empty = computeDisciplineScore([], today);
  console.assert(empty.score === 100, "[discipline] empty -> 100");
  const doneToday = computeDisciplineScore([{ date: today, status: "done" }], today);
  console.assert(doneToday.score === 100, "[discipline] today done only -> 100");
  const missedYesterday = computeDisciplineScore([{ date: "2026-01-26", status: "planned" }], today);
  console.assert(missedYesterday.score < 100, "[discipline] missed yesterday -> <100");
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
      const status = occ.status || "planned";
      if (dateKey && dateKey > today && status !== "skipped" && status !== "canceled") hasFutureOccurrences = true;
      if (dateKey && weekSet.has(dateKey)) {
        occCountByGoal.set(occ.goalId, (occCountByGoal.get(occ.goalId) || 0) + 1);
        if (status === "done") {
          occDoneByGoal.set(occ.goalId, (occDoneByGoal.get(occ.goalId) || 0) + 1);
        } else if (status !== "skipped" && status !== "canceled") {
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

export function getLoadSummary(data, nowDate = new Date()) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processGoals = goals.filter((g) => g && resolveGoalType(g) === "PROCESS");
  const processIds = new Set(processGoals.map((g) => g.id));
  const today = todayKey(nowDate);
  const weekKeys = buildWeekKeys(nowDate);
  const weekSet = new Set(weekKeys);

  let doneToday = 0;
  let doneWeek = 0;

  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  let remainingToday = 0;
  let remainingWeek = 0;
  let expectedToday = 0;
  let expectedWeek = 0;

  for (const occ of occurrences) {
    if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
    const dateKey = typeof occ.date === "string" ? occ.date : "";
    if (!dateKey) continue;
    const st = occ.status || "planned";

    // expected = planned+done (skip/cancel excluded)
    const countsForExpected = isOccExpected(st);
    const countsForRemaining = st !== "done" && st !== "skipped" && st !== "canceled";
    const isDone = st === "done";

    if (dateKey === today) {
      if (countsForExpected) expectedToday += 1;
      if (countsForRemaining) remainingToday += 1;
      if (isDone) doneToday += 1;
    }

    if (weekSet.has(dateKey)) {
      if (countsForExpected) expectedWeek += 1;
      if (countsForRemaining) remainingWeek += 1;
      if (isDone) doneWeek += 1;
    }
  }

  const missedWeek = Math.max(0, expectedWeek - doneWeek);

  return {
    // backward-compatible fields ("planned" used historically as remaining)
    today: { planned: remainingToday, done: doneToday, expected: expectedToday },
    week: { planned: remainingWeek, done: doneWeek, expected: expectedWeek, missed: missedWeek },
    emptyToday: expectedToday === 0,
  };
}

export function getDisciplineSummary(data, nowDate = new Date()) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processIds = new Set(goals.filter((g) => resolveGoalType(g) === "PROCESS").map((g) => g.id));
  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];

  // Fresh start guard: if user has no history at all (no sessions + no checks)
  // OR if they don't have any PROCESS goals yet, show 100% to avoid demotivating defaults.
  if (!occurrences.length || processIds.size === 0) {
    return {
      cancelledSessions7d: 0,
      noExecutionDays7d: 0,
      cancelledSessions30d: 0,
      noExecutionDays30d: 0,
      disciplineScore: 100,
      disciplineRatio: 1,
      windowDays: 30,
      isFreshStart: true,
    };
  }

  const buildWindowKeys = (days) => Array.from({ length: days }, (_, i) => todayKey(addDays(nowDate, -i)));

  function computePlannedCountByDate(windowKeys) {
    const windowSet = new Set(windowKeys);
    const plannedCountByDate = new Map();
    for (const k of windowKeys) plannedCountByDate.set(k, 0);

    for (const occ of occurrences) {
      if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
      const dateKey = typeof occ.date === "string" ? occ.date : "";
      if (!windowSet.has(dateKey)) continue;
      const status = occ.status || "planned";
      if (status === "skipped" || status === "canceled" || status === "done") continue;
      plannedCountByDate.set(dateKey, (plannedCountByDate.get(dateKey) || 0) + 1);
    }
    return plannedCountByDate;
  }

  function computeCancelledSessions(windowSet) {
    let cancelled = 0;
    for (const occ of occurrences) {
      if (!occ || occ.status !== "canceled") continue;
      const key = typeof occ.date === "string" ? occ.date : "";
      if (!windowSet.has(key)) continue;
      cancelled += 1;
    }
    return cancelled;
  }

  function computeNoExecutionDays(windowKeys, plannedCountByDate, doneCountByDate) {
    let noExecDays = 0;
    let hasAnySignal = false;

    for (const key of windowKeys) {
      const done = doneCountByDate.get(key) || 0;
      const planned = plannedCountByDate.get(key) || 0;
      if (done > 0) hasAnySignal = true;

      if (planned > 0 && done === 0) {
        noExecDays += 1;
        hasAnySignal = true;
      }
    }

    return { noExecDays, hasAnySignal };
  }

  // 7d metrics (kept for UI / future 7d star)
  const last7Keys = buildWindowKeys(7);
  const last7Set = new Set(last7Keys);
  const plannedByDate7d = computePlannedCountByDate(last7Keys);
  const doneCountByDate7d = collectDoneCountByDate(data || {}, last7Keys, processIds);
  const cancelledSessions7d = computeCancelledSessions(last7Set);
  const { noExecDays: noExecutionDays7d, hasAnySignal: hasAnySignal7d } = computeNoExecutionDays(
    last7Keys,
    plannedByDate7d,
    doneCountByDate7d
  );
  const totalPlanned7d = last7Keys.reduce((sum, k) => sum + (plannedByDate7d.get(k) || 0), 0);

  // 30d score (requested: 1 month)
  const last30Keys = buildWindowKeys(30);
  const last30Set = new Set(last30Keys);
  const plannedByDate30d = computePlannedCountByDate(last30Keys);
  const doneCountByDate30d = collectDoneCountByDate(data || {}, last30Keys, processIds);
  const cancelledSessions30d = computeCancelledSessions(last30Set);
  const { noExecDays: noExecutionDays30d, hasAnySignal: hasAnySignal30d } = computeNoExecutionDays(
    last30Keys,
    plannedByDate30d,
    doneCountByDate30d
  );
  const totalPlanned30d = last30Keys.reduce((sum, k) => sum + (plannedByDate30d.get(k) || 0), 0);

  if ((!hasAnySignal30d || totalPlanned30d === 0) && (!hasAnySignal7d || totalPlanned7d === 0)) {
    return {
      cancelledSessions7d: 0,
      noExecutionDays7d: 0,
      cancelledSessions30d: 0,
      noExecutionDays30d: 0,
      disciplineScore: 100,
      disciplineRatio: 1,
      windowDays: 30,
      isFreshStart: true,
    };
  }

  runDisciplineSanityChecks();
  const todayStr = todayKey(nowDate);
  const score7 = computeDisciplineScoreWindow(occurrences, last7Keys, todayStr);
  const score30 = computeDisciplineScoreWindow(occurrences, last30Keys, todayStr);

  // Primary score shown in UI = 7-day discipline.
  const disciplineScore = score7.score;

  return {
    cancelledSessions7d,
    noExecutionDays7d,
    cancelledSessions30d,
    noExecutionDays30d,
    disciplineScore,
    disciplineRatio: disciplineScore / 100,
    windowDays: 30,
    isFreshStart: false,
    disciplineScore7d: score7.score,
    disciplineRatio7d: score7.ratio,
    disciplineExpected7d: score7.expected,
    disciplineMissed7d: score7.missed,
    disciplineDone7d: score7.done,
    disciplineScore30d: score30.score,
    disciplineRatio30d: score30.ratio,
    disciplineExpected30d: score30.expected,
    disciplineMissed30d: score30.missed,
    disciplineDone30d: score30.done,
  };
}

export function getCategoryWeekBreakdown(data, categoryId, nowDate = new Date()) {
  if (!categoryId) return { expected: 0, done: 0, missed: 0, remaining: 0 };
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processIds = new Set(
    goals
      .filter((g) => g && g.categoryId === categoryId && resolveGoalType(g) === "PROCESS")
      .map((g) => g.id)
  );
  if (!processIds.size) return { expected: 0, done: 0, missed: 0, remaining: 0 };

  const weekKeys = buildWeekKeys(nowDate);
  const weekSet = new Set(weekKeys);
  const occs = Array.isArray(data?.occurrences) ? data.occurrences : [];

  let expected = 0;
  let done = 0;
  let remaining = 0;

  for (const occ of occs) {
    if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
    const dateKey = typeof occ.date === "string" ? occ.date : "";
    if (!weekSet.has(dateKey)) continue;
    const st = occ.status || "planned";
    if (!isOccExpected(st)) continue;
    expected += 1;
    if (st === "done") done += 1;
    if (st !== "done" && st !== "skipped" && st !== "canceled") remaining += 1;
  }

  const missed = Math.max(0, expected - done);
  return { expected, done, missed, remaining };
}

export function getDisciplineStreak7d(data, nowDate = new Date()) {
  // Streak = consecutive past days (ending yesterday) where ALL expected occurrences were done.
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processIds = new Set(goals.filter((g) => resolveGoalType(g) === "PROCESS").map((g) => g.id));
  const occs = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const todayStr = todayKey(nowDate);

  const keys = buildWeekKeys(nowDate);
  // keys are Mon..Sun; we want walk backwards from yesterday.
  const window = keys.filter((k) => k < todayStr).sort();
  let streak = 0;

  for (let i = window.length - 1; i >= 0; i -= 1) {
    const day = window[i];
    let expected = 0;
    let done = 0;

    for (const occ of occs) {
      if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
      if (occ.date !== day) continue;
      const st = occ.status || "planned";
      if (!isOccExpected(st)) continue;
      expected += 1;
      if (st === "done") done += 1;
    }

    if (expected === 0) {
      // No expected work that day: do not break the streak; also do not increase it.
      continue;
    }

    if (done >= expected) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

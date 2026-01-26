import { addDays, startOfWeekKey, todayKey } from "../utils/dates";
import { resolveGoalType } from "../domain/goalType";

function parseDateKey(key) {
  if (typeof key !== "string") return null;
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
}

function appDowFromDateKey(key) {
  const d = parseDateKey(key);
  if (!d) return null;
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function buildWeekKeys(nowDate) {
  const weekStartKey = startOfWeekKey(nowDate);
  const weekStartDate = new Date(`${weekStartKey}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => todayKey(addDays(weekStartDate, i)));
}

function collectDoneByDate(data, dateKeys) {
  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const dateSet = new Set(dateKeys);
  const map = new Map();
  for (const key of dateKeys) map.set(key, new Set());

  for (const occ of occurrences) {
    if (!occ || occ.status !== "done") continue;
    const key = typeof occ.date === "string" ? occ.date : "";
    if (!dateSet.has(key)) continue;
    const set = map.get(key);
    if (!set) continue;
    if (occ.goalId) set.add(occ.goalId);
  }

  return map;
}

function countPlannedFromSchedule(schedule, dateKeys) {
  if (!schedule || typeof schedule !== "object") return { planned: 0, available: false };
  if (!schedule.remindersEnabled) return { planned: 0, available: false };
  const timeSlots = Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [];
  if (!timeSlots.length) return { planned: 0, available: false };
  const days = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : null;
  let planned = 0;
  for (const key of dateKeys) {
    const dow = appDowFromDateKey(key);
    if (!dow) continue;
    if (!days || days.includes(dow)) planned += timeSlots.length;
  }
  return { planned, available: true };
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
      if (dateKey && dateKey > today && status !== "skipped") hasFutureOccurrences = true;
      if (dateKey && weekSet.has(dateKey)) {
        occCountByGoal.set(occ.goalId, (occCountByGoal.get(occ.goalId) || 0) + 1);
        if (status === "done") {
          occDoneByGoal.set(occ.goalId, (occDoneByGoal.get(occ.goalId) || 0) + 1);
        } else if (status !== "skipped") {
          occPlannedByGoal.set(occ.goalId, (occPlannedByGoal.get(occ.goalId) || 0) + 1);
        }
      }
    }
  }

  const doneByDate = collectDoneByDate(data || {}, weekKeys);
  const doneDatesByGoal = new Map();
  for (const [dateKey, set] of doneByDate.entries()) {
    for (const id of set) {
      if (!processIds.has(id)) continue;
      const bucket = doneDatesByGoal.get(id) || new Set();
      bucket.add(dateKey);
      doneDatesByGoal.set(id, bucket);
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
    const doneFallback = doneDatesByGoal.get(goalId)?.size || 0;
    const doneCount = Math.max(occDoneByGoal.get(goalId) || 0, doneFallback);
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

  const doneByDate = collectDoneByDate(data || {}, weekKeys);
  const countDoneForDate = (key) => {
    const set = doneByDate.get(key);
    if (!set) return 0;
    let count = 0;
    for (const id of set) if (processIds.has(id)) count += 1;
    return count;
  };

  const doneToday = countDoneForDate(today);
  const doneWeek = weekKeys.reduce((sum, key) => sum + countDoneForDate(key), 0);

  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  let plannedToday = 0;
  let plannedWeek = 0;

  for (const occ of occurrences) {
    if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
    const dateKey = typeof occ.date === "string" ? occ.date : "";
    const status = occ.status || "planned";
    if (status === "skipped" || status === "done") continue;
    if (dateKey === today) plannedToday += 1;
    if (dateKey && weekSet.has(dateKey)) plannedWeek += 1;
  }

  return {
    today: { planned: plannedToday, done: doneToday },
    week: { planned: plannedWeek, done: doneWeek },
    emptyToday: plannedToday === 0,
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

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
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
      if (status === "skipped" || status === "done") continue;
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

  function computeNoExecutionDays(windowKeys, plannedCountByDate, doneByDate) {
    let noExecDays = 0;
    let hasAnySignal = false;

    for (const key of windowKeys) {
      const set = doneByDate.get(key) || new Set();
      let done = 0;
      for (const id of set) if (processIds.has(id)) done += 1;

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
  const doneByDate7d = collectDoneByDate(data || {}, last7Keys);
  const cancelledSessions7d = computeCancelledSessions(last7Set);
  const { noExecDays: noExecutionDays7d, hasAnySignal: hasAnySignal7d } = computeNoExecutionDays(
    last7Keys,
    plannedByDate7d,
    doneByDate7d
  );
  const totalPlanned7d = last7Keys.reduce((sum, k) => sum + (plannedByDate7d.get(k) || 0), 0);

  // 30d score (requested: 1 month)
  const last30Keys = buildWindowKeys(30);
  const last30Set = new Set(last30Keys);
  const plannedByDate30d = computePlannedCountByDate(last30Keys);
  const doneByDate30d = collectDoneByDate(data || {}, last30Keys);
  const cancelledSessions30d = computeCancelledSessions(last30Set);
  const { noExecDays: noExecutionDays30d, hasAnySignal: hasAnySignal30d } = computeNoExecutionDays(
    last30Keys,
    plannedByDate30d,
    doneByDate30d
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

  // Capital discipline: starts at 100 and only decreases on failures.
  // Penalties are gentler on 30d to avoid collapsing too fast.
  let disciplineScore = 100;
  disciplineScore -= noExecutionDays30d * 3;
  disciplineScore -= cancelledSessions30d * 1.5;
  disciplineScore = clamp(disciplineScore, 0, 100);

  return {
    cancelledSessions7d,
    noExecutionDays7d,
    cancelledSessions30d,
    noExecutionDays30d,
    disciplineScore,
    disciplineRatio: disciplineScore / 100,
    windowDays: 30,
    isFreshStart: false,
  };
}

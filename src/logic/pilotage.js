import { addDays, startOfWeekKey, todayKey } from "../utils/dates";

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

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
  const checks = data?.checks && typeof data.checks === "object" ? data.checks : {};
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const dateSet = new Set(dateKeys);
  const map = new Map();
  for (const key of dateKeys) map.set(key, new Set());

  for (const key of dateKeys) {
    const bucket = checks?.[key];
    const ids = Array.isArray(bucket?.habits) ? bucket.habits : [];
    const set = map.get(key);
    if (!set) continue;
    for (const id of ids) set.add(id);
  }

  for (const s of sessions) {
    if (!s || s.status !== "done") continue;
    const key = typeof s.dateKey === "string" ? s.dateKey : typeof s.date === "string" ? s.date : "";
    if (!dateSet.has(key)) continue;
    const set = map.get(key);
    if (!set) continue;
    const doneIds = Array.isArray(s.doneHabitIds)
      ? s.doneHabitIds
      : Array.isArray(s.doneHabits)
        ? s.doneHabits
        : [];
    if (doneIds.length) {
      for (const id of doneIds) set.add(id);
    } else {
      if (s.habitId) set.add(s.habitId);
      if (Array.isArray(s.habitIds)) {
        for (const id of s.habitIds) set.add(id);
      }
    }
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

export function getCategoryStatus(data, categoryId, nowDate = new Date()) {
  const { outcomesCount, processCount } = getCategoryCounts(data, categoryId);
  if (outcomesCount === 0 && processCount === 0) return "EMPTY";
  if (processCount === 0) return "ACTIVE";

  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processGoals = goals.filter(
    (g) => g && g.categoryId === categoryId && resolveGoalType(g) === "PROCESS"
  );
  if (!processGoals.length) return "ACTIVE";

  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const reminders = Array.isArray(data?.reminders) ? data.reminders : [];
  const reminderGoalIds = new Set(
    reminders.filter((r) => r && r.goalId && r.enabled !== false).map((r) => r.goalId)
  );
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
    const schedulePlan = countPlannedFromSchedule(goal.schedule, weekKeys);
    const reminderPlan = reminderGoalIds.has(goalId);
    const plannedAvailable = hasOccurrencePlan || schedulePlan.available;
    if (plannedAvailable) hasPlannedData = true;

    if (!plannedAvailable) {
      if (isGoalActive(goal) && (hasOccurrencePlan || schedulePlan.available || reminderPlan)) {
        hasActivePlannedGoal = true;
      }
      continue;
    }

    if (isGoalActive(goal)) hasActivePlannedGoal = true;

    const plannedCount = hasOccurrencePlan
      ? occPlannedByGoal.get(goalId) || 0
      : schedulePlan.available
        ? schedulePlan.planned
        : 0;
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

  if (occurrences.length) {
    for (const occ of occurrences) {
      if (!occ || typeof occ.goalId !== "string" || !processIds.has(occ.goalId)) continue;
      const dateKey = typeof occ.date === "string" ? occ.date : "";
      const status = occ.status || "planned";
      if (status === "skipped" || status === "done") continue;
      if (dateKey === today) plannedToday += 1;
      if (dateKey && weekSet.has(dateKey)) plannedWeek += 1;
    }
  } else {
    for (const goal of processGoals) {
      const schedulePlan = countPlannedFromSchedule(goal.schedule, weekKeys);
      if (!schedulePlan.available || schedulePlan.planned === 0) continue;
      plannedWeek += schedulePlan.planned;
      const todayPlan = countPlannedFromSchedule(goal.schedule, [today]);
      if (todayPlan.available) plannedToday += todayPlan.planned;
    }
  }

  return {
    today: { planned: plannedToday, done: doneToday },
    week: { planned: plannedWeek, done: doneWeek },
    emptyToday: plannedToday === 0,
  };
}

export function getDisciplineSummary(data, nowDate = new Date()) {
  const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const processIds = new Set(goals.filter((g) => resolveGoalType(g) === "PROCESS").map((g) => g.id));

  const last7Keys = Array.from({ length: 7 }, (_, i) => todayKey(addDays(nowDate, -i)));
  const last7Set = new Set(last7Keys);
  let cancelledSessions7d = 0;

  for (const s of sessions) {
    if (!s || s.status !== "skipped") continue;
    const key = typeof s.dateKey === "string" ? s.dateKey : typeof s.date === "string" ? s.date : "";
    if (last7Set.has(key)) cancelledSessions7d += 1;
  }

  const doneByDate = collectDoneByDate(data || {}, last7Keys);
  let noExecutionDays7d = 0;
  for (const key of last7Keys) {
    const set = doneByDate.get(key) || new Set();
    let done = 0;
    for (const id of set) if (processIds.has(id)) done += 1;
    if (done === 0) noExecutionDays7d += 1;
  }

  return { cancelledSessions7d, noExecutionDays7d };
}

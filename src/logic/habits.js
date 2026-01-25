import { addDays, startOfWeekKey, todayKey, yearKey } from "../utils/dates";
import { clamp } from "../utils/helpers";
import { resolveGoalType } from "../domain/goalType";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { findOccurrenceForGoalDateDeterministic, setOccurrenceStatus, upsertOccurrence } from "./occurrences";

function getProcessGoals(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.filter((g) => resolveGoalType(g) === "PROCESS");
}

export function getHabitList(data) {
  const process = getProcessGoals(data);
  if (process.length) return process;
  return Array.isArray(data?.habits) ? data.habits : [];
}

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    if (Array.isArray(source.occurrences)) return source.occurrences;
  }
  return [];
}

function hasDoneOnDate(occurrences, habitId, dateKey) {
  if (!habitId || !dateKey) return false;
  return occurrences.some((o) => o && o.goalId === habitId && o.date === dateKey && o.status === "done");
}

export function computeHabitProgress(habit, source, now = new Date()) {
  const occurrences = resolveOccurrences(source);
  if (habit.cadence === "DAILY") {
    const k = todayKey(now);
    const done = hasDoneOnDate(occurrences, habit.id, k) ? 1 : 0;
    return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
  }
  if (habit.cadence === "YEARLY") {
    const y = yearKey(now);
    let done = 0;
    for (const occ of occurrences) {
      if (!occ || occ.goalId !== habit.id || occ.status !== "done") continue;
      if (typeof occ.date !== "string" || !occ.date.startsWith(`${y}-`)) continue;
      done += 1;
    }
    return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
  }

  const wk = startOfWeekKey(now);
  const start = new Date(`${wk}T12:00:00`);
  let done = 0;
  if (!Number.isNaN(start.getTime())) {
    for (let i = 0; i < 7; i += 1) {
      const key = todayKey(addDays(start, i));
      if (hasDoneOnDate(occurrences, habit.id, key)) done += 1;
    }
  }
  return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
}

export function computeGlobalAvgForDay(data, d = new Date()) {
  const list = getHabitList(data);
  if (!list.length) return 0;
  let sum = 0;
  for (const h of list) sum += clamp(computeHabitProgress(h, data, d).ratio, 0, 1);
  return sum / list.length;
}

export function computeGlobalAvgForWeek(data, d = new Date()) {
  // V2: simplifié: on calcule comme une moyenne des ratios “du moment”
  const list = getHabitList(data);
  if (!list.length) return 0;
  let sum = 0;
  for (const h of list) sum += clamp(computeHabitProgress(h, data, d).ratio, 0, 1);
  return sum / list.length;
}

export function computeStreakDays(data, now = new Date()) {
  let streak = 0;
  const cursor = new Date(now);
  for (let i = 0; i < 366; i++) {
    const avg = computeGlobalAvgForDay(data, cursor);
    if (avg >= 1) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function resolveHabit(data, habitId) {
  const list = getHabitList(data);
  const direct = list.find((h) => h.id === habitId);
  if (direct) return direct;
  return null;
}

function setHabitDoneForDate(data, habitId, dateKey, done) {
  if (!data || !habitId) return data;
  const key = normalizeLocalDateKey(dateKey) || todayLocalKey();
  if (!key) return data;
  const occurrences = resolveOccurrences(data);
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const hasAny = occurrences.some((o) => o && o.goalId === habitId && o.date === key);
  let nextOccurrences = occurrences;
  if (done) {
    if (hasAny) {
      const match = findOccurrenceForGoalDateDeterministic(occurrences, habitId, key, "");
      if (match && match.start) {
        nextOccurrences = setOccurrenceStatus(habitId, key, match.start, "done", { occurrences, goals });
      }
    } else {
      nextOccurrences = upsertOccurrence(habitId, key, "00:00", null, { status: "done" }, { occurrences, goals });
    }
  } else if (hasAny) {
    const doneOccurrences = occurrences.filter(
      (o) => o && o.goalId === habitId && o.date === key && o.status === "done"
    );
    if (doneOccurrences.length) {
      const match = findOccurrenceForGoalDateDeterministic(doneOccurrences, habitId, key, "00:00");
      if (match && match.start) {
        nextOccurrences = setOccurrenceStatus(habitId, key, match.start, "planned", { occurrences, goals });
      }
    }
  }
  if (nextOccurrences === occurrences) return data;
  return { ...data, occurrences: nextOccurrences };
}

export function incHabit(data, habitId, at = new Date()) {
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(at);
  return setHabitDoneForDate(data, habitId, dKey, true);
}

export function decHabit(data, habitId, at = new Date()) {
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(at);
  return setHabitDoneForDate(data, habitId, dKey, false);
}

export function toggleHabitOnce(data, habitId) {
  const now = new Date();
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(now);
  const occurrences = resolveOccurrences(data);
  const has = hasDoneOnDate(occurrences, habitId, dKey);
  return setHabitDoneForDate(data, habitId, dKey, !has);
}

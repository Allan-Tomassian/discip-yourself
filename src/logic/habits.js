import { addDays, startOfWeekKey, todayKey, yearKey } from "../utils/dates";
import { clamp } from "../utils/helpers";
import { resolveGoalType } from "../domain/goalType";
import { hasHabitChecked, setHabitChecked } from "./checks";

function getProcessGoals(data) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.filter((g) => resolveGoalType(g) === "PROCESS");
}

export function getHabitList(data) {
  const process = getProcessGoals(data);
  if (process.length) return process;
  return Array.isArray(data?.habits) ? data.habits : [];
}

export function computeHabitProgress(habit, checks, now = new Date()) {
  const state = { checks };
  if (habit.cadence === "DAILY") {
    const k = todayKey(now);
    const done = hasHabitChecked(state, k, habit.id) ? 1 : 0;
    return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
  }
  if (habit.cadence === "YEARLY") {
    const y = yearKey(now);
    let done = 0;
    if (checks && typeof checks === "object") {
      for (const [key, bucket] of Object.entries(checks)) {
        if (typeof key !== "string" || !key.startsWith(`${y}-`)) continue;
        const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
        if (habits.includes(habit.id)) done += 1;
      }
    }
    return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
  }

  const wk = startOfWeekKey(now);
  const start = new Date(`${wk}T12:00:00`);
  let done = 0;
  if (!Number.isNaN(start.getTime())) {
    for (let i = 0; i < 7; i += 1) {
      const key = todayKey(addDays(start, i));
      if (hasHabitChecked(state, key, habit.id)) done += 1;
    }
  }
  return { done, target: habit.target, ratio: habit.target ? done / habit.target : 0 };
}

export function computeGlobalAvgForDay(data, d = new Date()) {
  const list = getHabitList(data);
  if (!list.length) return 0;
  let sum = 0;
  for (const h of list) sum += clamp(computeHabitProgress(h, data.checks, d).ratio, 0, 1);
  return sum / list.length;
}

export function computeGlobalAvgForWeek(data, d = new Date()) {
  // V2: simplifié: on calcule comme une moyenne des ratios “du moment”
  const list = getHabitList(data);
  if (!list.length) return 0;
  let sum = 0;
  for (const h of list) sum += clamp(computeHabitProgress(h, data.checks, d).ratio, 0, 1);
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

export function incHabit(data, habitId, at = new Date()) {
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(at);
  return setHabitChecked(data, dKey, habitId, true);
}

export function decHabit(data, habitId, at = new Date()) {
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(at);
  return setHabitChecked(data, dKey, habitId, false);
}

export function toggleHabitOnce(data, habitId) {
  const now = new Date();
  const habit = resolveHabit(data, habitId);
  if (!habit) return data;
  const dKey = todayKey(now);
  const has = hasHabitChecked(data, dKey, habitId);
  return setHabitChecked(data, dKey, habitId, !has);
}

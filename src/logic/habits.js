import { todayKey, startOfWeekKey, yearKey } from "../utils/dates";
import { clamp } from "../utils/helpers";

export function computeHabitProgress(habit, checks, now = new Date()) {
  const h = checks[habit.id] || { daily: {}, weekly: {}, yearly: {} };

  if (habit.cadence === "DAILY") {
    const k = todayKey(now);
    const count = h.daily?.[k] || 0;
    return { done: count, target: habit.target, ratio: habit.target ? count / habit.target : 0 };
  }
  if (habit.cadence === "YEARLY") {
    const y = yearKey(now);
    const count = h.yearly?.[y] || 0;
    return { done: count, target: habit.target, ratio: habit.target ? count / habit.target : 0 };
  }

  const wk = startOfWeekKey(now);
  const count = h.weekly?.[wk] || 0;
  return { done: count, target: habit.target, ratio: habit.target ? count / habit.target : 0 };
}

export function computeGlobalAvgForDay(data, d = new Date()) {
  const list = data.habits;
  if (!list.length) return 0;
  let sum = 0;
  for (const h of list) sum += clamp(computeHabitProgress(h, data.checks, d).ratio, 0, 1);
  return sum / list.length;
}

export function computeGlobalAvgForWeek(data, d = new Date()) {
  // V2: simplifié: on calcule comme une moyenne des ratios “du moment”
  const list = data.habits;
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
  const list = Array.isArray(data?.habits) ? data.habits : [];
  const direct = list.find((h) => h.id === habitId);
  if (direct) return direct;
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const goal = goals.find((g) => g?.id === habitId);
  if (!goal) return null;
  const raw = (goal.type || goal.kind || goal.planType || "").toString().toUpperCase();
  const isProcess = raw === "PROCESS" || raw === "ACTION" || raw === "ONE_OFF";
  return isProcess ? goal : null;
}

export function incHabit(data, habitId, at = new Date()) {
  const dKey = todayKey(at);
  const wKey = startOfWeekKey(at);
  const yKey = yearKey(at);

  const habit = resolveHabit(data, habitId);
  if (!habit) return data;

  const checks = { ...data.checks };
  const bucket = checks[habitId] || { daily: {}, weekly: {}, yearly: {} };

  if (habit.cadence === "DAILY") {
    const cur = bucket.daily[dKey] || 0;
    bucket.daily = { ...bucket.daily, [dKey]: cur + 1 };
  } else if (habit.cadence === "YEARLY") {
    const cur = bucket.yearly[yKey] || 0;
    bucket.yearly = { ...bucket.yearly, [yKey]: cur + 1 };
  } else {
    const cur = bucket.weekly[wKey] || 0;
    bucket.weekly = { ...bucket.weekly, [wKey]: cur + 1 };
  }

  checks[habitId] = bucket;
  return { ...data, checks };
}

export function decHabit(data, habitId, at = new Date()) {
  const dKey = todayKey(at);
  const wKey = startOfWeekKey(at);
  const yKey = yearKey(at);

  const habit = resolveHabit(data, habitId);
  if (!habit) return data;

  const checks = { ...data.checks };
  const bucket = checks[habitId] || { daily: {}, weekly: {}, yearly: {} };

  if (habit.cadence === "DAILY") {
    const cur = bucket.daily[dKey] || 0;
    bucket.daily = { ...bucket.daily, [dKey]: Math.max(0, cur - 1) };
  } else if (habit.cadence === "YEARLY") {
    const cur = bucket.yearly[yKey] || 0;
    bucket.yearly = { ...bucket.yearly, [yKey]: Math.max(0, cur - 1) };
  } else {
    const cur = bucket.weekly[wKey] || 0;
    bucket.weekly = { ...bucket.weekly, [wKey]: Math.max(0, cur - 1) };
  }

  checks[habitId] = bucket;
  return { ...data, checks };
}

export function toggleHabitOnce(data, habitId) {
  const now = new Date();
  const dKey = todayKey(now);
  const wKey = startOfWeekKey(now);
  const yKey = yearKey(now);

  const habit = resolveHabit(data, habitId);
  if (!habit) return data;

  const bucket = data.checks?.[habitId] || { daily: {}, weekly: {}, yearly: {} };

  let cur = 0;
  if (habit.cadence === "DAILY") {
    cur = bucket.daily?.[dKey] || 0;
  } else if (habit.cadence === "YEARLY") {
    cur = bucket.yearly?.[yKey] || 0;
  } else {
    cur = bucket.weekly?.[wKey] || 0;
  }

  return cur > 0 ? decHabit(data, habitId) : incHabit(data, habitId);
}

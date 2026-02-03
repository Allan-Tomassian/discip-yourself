import { addDays } from "../utils/dates";
import { normalizeLocalDateKey, toLocalDateKey } from "../utils/dateKey";

// Source of truth (based on src/logic/occurrences.js + additional statuses used in repo)
export const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
export const EXTRA_STATUS_VALUES = new Set(["missed", "rescheduled", "in_progress"]);

export const FINAL_STATUSES = new Set(["done", "skipped", "canceled", "missed", "rescheduled"]);
export const DONE_STATUSES = new Set(["done"]);
export const MISSED_STATUSES = new Set(["missed"]);
export const CANCELED_STATUSES = new Set(["skipped", "canceled"]);

const EXPECTED_STATUSES = new Set([
  "planned",
  "done",
  "missed",
  "canceled",
  "skipped",
  "rescheduled",
  "in_progress",
]);

function normalizeStatus(raw) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (STATUS_VALUES.has(value) || EXTRA_STATUS_VALUES.has(value)) return value;
  return "planned";
}

export function isFinalOccurrenceStatus(status) {
  const normalized = normalizeStatus(status);
  return FINAL_STATUSES.has(normalized);
}

function isAnytimeLegacyOccurrence(occ) {
  if (!occ || typeof occ !== "object") return false;
  const hasNoTimeFlag = occ.noTime === true;
  const hasZeroStart = typeof occ.start === "string" && occ.start === "00:00";
  const hasWindowBounds = Boolean(occ.windowStartAt || occ.windowEndAt);
  return (hasNoTimeFlag || hasZeroStart) && !hasWindowBounds;
}

function createEmptyStats() {
  return {
    expected: 0,
    done: 0,
    missed: 0,
    canceled: 0,
    planned: 0,
    remaining: 0,
    completionRate: 0,
    netScore: 0,
  };
}

function addOccurrenceToStats(stats, occ) {
  if (!occ || typeof occ !== "object") return;
  if (isAnytimeLegacyOccurrence(occ)) return;
  const status = normalizeStatus(occ.status);

  if (EXPECTED_STATUSES.has(status)) stats.expected += 1;
  if (DONE_STATUSES.has(status)) stats.done += 1;
  if (MISSED_STATUSES.has(status)) stats.missed += 1;
  if (CANCELED_STATUSES.has(status)) stats.canceled += 1;
  if (status === "planned") stats.planned += 1;
  if (!DONE_STATUSES.has(status) && !CANCELED_STATUSES.has(status)) stats.remaining += 1;

  if (DONE_STATUSES.has(status)) {
    const points = Number.isFinite(occ.pointsAwarded) ? occ.pointsAwarded : null;
    if (points != null) stats.netScore += points;
  }
}

function finalizeStats(stats) {
  const expected = Number(stats.expected) || 0;
  const done = Number(stats.done) || 0;
  stats.completionRate = expected > 0 ? done / expected : 0;
  return stats;
}

function buildDateKeys(fromKey, toKey) {
  const from = normalizeLocalDateKey(fromKey);
  const to = normalizeLocalDateKey(toKey);
  if (!from || !to) return [];
  if (to < from) return [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function getWindowBounds(windowName, nowDate = new Date()) {
  const today = toLocalDateKey(nowDate);
  const name = typeof windowName === "string" ? windowName.trim().toLowerCase() : "";
  if (name === "today") return { fromKey: today, toKey: today };
  if (name === "7d") {
    return { fromKey: toLocalDateKey(addDays(nowDate, -6)), toKey: today };
  }
  if (name === "14d") {
    return { fromKey: toLocalDateKey(addDays(nowDate, -13)), toKey: today };
  }
  if (name === "90d") {
    return { fromKey: toLocalDateKey(addDays(nowDate, -89)), toKey: today };
  }
  return { fromKey: today, toKey: today };
}

export function selectOccurrencesInRange(state, fromKey, toKey, { goalIds = null, categoryId = null } = {}) {
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const from = normalizeLocalDateKey(fromKey);
  const to = normalizeLocalDateKey(toKey);
  if (!from || !to) return [];

  const goalSet = Array.isArray(goalIds) ? new Set(goalIds.filter(Boolean)) : null;
  const categorySet = categoryId
    ? new Set(goals.filter((g) => g && g.categoryId === categoryId).map((g) => g.id))
    : null;

  return occurrences.filter((occ) => {
    if (!occ || typeof occ.date !== "string") return false;
    const dateKey = occ.date;
    if (dateKey < from || dateKey > to) return false;
    if (goalSet && !goalSet.has(occ.goalId)) return false;
    if (categorySet && !categorySet.has(occ.goalId)) return false;
    return true;
  });
}

export function computeStats(occurrences, { goals } = {}) {
  void goals;
  const stats = createEmptyStats();
  const list = Array.isArray(occurrences) ? occurrences : [];
  for (const occ of list) addOccurrenceToStats(stats, occ);
  return finalizeStats(stats);
}

export function computeDailyStats(state, fromKey, toKey, filters = {}) {
  const dateKeys = buildDateKeys(fromKey, toKey);
  const byDate = new Map();
  for (const key of dateKeys) byDate.set(key, createEmptyStats());

  const list = selectOccurrencesInRange(state, fromKey, toKey, filters);
  for (const occ of list) {
    if (!occ || typeof occ.date !== "string") continue;
    const bucket = byDate.get(occ.date);
    if (!bucket) continue;
    addOccurrenceToStats(bucket, occ);
  }

  const totals = createEmptyStats();
  for (const stats of byDate.values()) {
    finalizeStats(stats);
    totals.expected += stats.expected;
    totals.done += stats.done;
    totals.missed += stats.missed;
    totals.canceled += stats.canceled;
    totals.planned += stats.planned;
    totals.remaining += stats.remaining;
    totals.netScore += stats.netScore;
  }
  finalizeStats(totals);

  return { byDate, totals };
}

export function computeGoalStats(state, fromKey, toKey, filters = {}) {
  const list = selectOccurrencesInRange(state, fromKey, toKey, filters);
  const map = new Map();

  for (const occ of list) {
    if (!occ || typeof occ.goalId !== "string") continue;
    if (!map.has(occ.goalId)) map.set(occ.goalId, createEmptyStats());
    const bucket = map.get(occ.goalId);
    addOccurrenceToStats(bucket, occ);
  }

  for (const bucket of map.values()) finalizeStats(bucket);
  return map;
}

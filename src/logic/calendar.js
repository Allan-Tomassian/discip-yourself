import { uid } from "../utils/helpers";

const STATUS_VALUES = new Set(["planned", "done", "skipped"]);

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function normalizeStatus(status) {
  const raw = typeof status === "string" ? status : "";
  return STATUS_VALUES.has(raw) ? raw : "planned";
}

function normalizeDurationMinutes(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded >= 0 ? rounded : null;
}

function isIsoDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Lexicographic compare works for ISO dates YYYY-MM-DD.
 */
function inRange(date, startDate, endDate) {
  if (!isIsoDateString(date)) return false;
  if (isIsoDateString(startDate) && date < startDate) return false;
  if (isIsoDateString(endDate) && date > endDate) return false;
  return true;
}

export function listOccurrencesByDate(date, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof date !== "string" || !date.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.date === date);
}

export function listOccurrencesForGoal(goalId, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof goalId !== "string" || !goalId.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.goalId === goalId);
}

export function listOccurrencesInRange(startDate, endDate, source) {
  const occurrences = resolveOccurrences(source);
  // If inputs invalid, return a copy (no filtering) to avoid "empty calendar"
  if (!isIsoDateString(startDate) && !isIsoDateString(endDate)) return occurrences.slice();
  return occurrences.filter((o) => o && inRange(o.date, startDate, endDate));
}

/**
 * Returns { [date]: [occurrence, ...] }
 */
export function groupOccurrencesByDate(startDate, endDate, source) {
  const occurrences = listOccurrencesInRange(startDate, endDate, source);
  const map = Object.create(null);
  for (const o of occurrences) {
    if (!o || !isIsoDateString(o.date)) continue;
    if (!map[o.date]) map[o.date] = [];
    map[o.date].push(o);
  }
  return map;
}

/**
 * For a given day, pick a "primary" goalId to drive the calendar color.
 * Rule: take the earliest occurrence by start time, otherwise first one.
 */
export function getPrimaryGoalIdForDate(date, source) {
  const list = listOccurrencesByDate(date, source);
  if (!list.length) return null;

  let best = list[0];
  for (const o of list) {
    if (!o) continue;
    // Prefer earliest start if both have start
    if (typeof o.start === "string" && typeof best.start === "string") {
      if (o.start < best.start) best = o;
    } else if (typeof o.start === "string" && typeof best.start !== "string") {
      best = o;
    }
  }
  return best && typeof best.goalId === "string" ? best.goalId : null;
}

/**
 * Same as getPrimaryGoalIdForDate, but by default ignores "skipped" occurrences.
 * This is better for calendar coloring.
 */
export function getPrimaryGoalIdForDateForCalendar(date, source, options = {}) {
  const { includeSkipped = false } = options;
  const listAll = listOccurrencesByDate(date, source);
  const list = includeSkipped ? listAll : listAll.filter((o) => o && o.status !== "skipped");
  if (!list.length) return null;

  let best = list[0];
  for (const o of list) {
    if (!o) continue;
    // Prefer earliest start if both have start
    if (typeof o.start === "string" && typeof best.start === "string") {
      if (o.start < best.start) best = o;
    } else if (typeof o.start === "string" && typeof best.start !== "string") {
      best = o;
    }
  }
  return best && typeof best.goalId === "string" ? best.goalId : null;
}

function buildIdMap(list) {
  const map = Object.create(null);
  if (!Array.isArray(list)) return map;
  for (const item of list) {
    if (!item || typeof item.id !== "string") continue;
    map[item.id] = item;
  }
  return map;
}

/**
 * Returns the category color for a goalId, or null if not resolvable.
 */
export function getCategoryColorForGoalId(goalId, goals, categories) {
  if (typeof goalId !== "string" || !goalId.trim()) return null;
  const goalsById = buildIdMap(goals);
  const catsById = buildIdMap(categories);
  const goal = goalsById[goalId];
  if (!goal || typeof goal.categoryId !== "string") return null;
  const cat = catsById[goal.categoryId];
  const color = cat && typeof cat.color === "string" ? cat.color : null;
  return color;
}

/**
 * Main helper for UI:
 * - picks the primary goal for that date (earliest start)
 * - resolves its category color
 */
export function getDayColorForDate(date, occurrencesSource, goals, categories, options = {}) {
  const goalId = getPrimaryGoalIdForDateForCalendar(date, occurrencesSource, options);
  return getCategoryColorForGoalId(goalId, goals, categories);
}

/**
 * Useful for UI badges (planned/done counts).
 */
export function getDayCountsForDate(date, source, options = {}) {
  const { includeSkipped = false } = options;
  const listAll = listOccurrencesByDate(date, source);
  const list = includeSkipped ? listAll : listAll.filter((o) => o && o.status !== "skipped");
  let planned = 0;
  let done = 0;
  let skipped = 0;
  for (const o of listAll) {
    if (!o) continue;
    if (o.status === "done") done += 1;
    else if (o.status === "skipped") skipped += 1;
    else planned += 1;
  }
  return { planned, done, skipped };
}

export function addOccurrence(goalId, date, start, durationMinutes, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof goalId !== "string" || !goalId.trim()) return occurrences.slice();
  if (typeof date !== "string" || !date.trim()) return occurrences.slice();
  if (typeof start !== "string" || !start.trim()) return occurrences.slice();

  const occurrence = {
    id: uid(),
    goalId,
    date,
    start,
    durationMinutes: normalizeDurationMinutes(durationMinutes),
    status: "planned",
  };

  return [...occurrences, occurrence];
}

export function updateOccurrence(id, patch, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof id !== "string" || !id.trim()) return occurrences.slice();
  if (!patch || typeof patch !== "object") return occurrences.slice();

  const nextPatch = { ...patch };
  if ("status" in nextPatch) nextPatch.status = normalizeStatus(nextPatch.status);
  if ("durationMinutes" in nextPatch) nextPatch.durationMinutes = normalizeDurationMinutes(nextPatch.durationMinutes);

  return occurrences.map((o) => {
    if (!o || o.id !== id) return o;
    return { ...o, ...nextPatch, id: o.id };
  });
}

export function deleteOccurrence(id, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof id !== "string" || !id.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.id !== id);
}
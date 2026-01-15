import {
  addOccurrence,
  deleteOccurrence,
  listOccurrencesByDate,
  listOccurrencesForGoal,
  updateOccurrence,
} from "./occurrences";

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
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

export { addOccurrence, deleteOccurrence, listOccurrencesByDate, listOccurrencesForGoal, updateOccurrence };

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

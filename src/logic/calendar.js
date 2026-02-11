import {
  addOccurrence,
  deleteOccurrence,
  listOccurrencesByDate,
  listOccurrencesForGoal,
  updateOccurrence,
} from "./occurrences";
import { normalizeLocalDateKey } from "../utils/dateKey";

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function isIsoDateString(value) {
  return Boolean(normalizeLocalDateKey(value));
}

function isNoTimeOccurrence(o) {
  if (!o) return false;
  if (o.noTime) return true;
  // Current placeholder convention for no-time occurrences
  return typeof o.start === "string" && o.start === "00:00";
}

function statusRank(o) {
  // Higher is more important for driving "primary" selection.
  // planned > done > skipped/other
  const st = o && typeof o.status === "string" ? o.status : "";
  if (st === "planned") return 3;
  if (st === "done") return 2;
  if (st === "skipped" || st === "canceled") return 0;
  return 1;
}

/**
 * Lexicographic compare works for ISO dates YYYY-MM-DD.
 */
function inRange(date, startDate, endDate) {
  const dayKey = normalizeLocalDateKey(date);
  if (!dayKey) return false;
  const startKey = normalizeLocalDateKey(startDate);
  const endKey = normalizeLocalDateKey(endDate);
  if (startKey && dayKey < startKey) return false;
  if (endKey && dayKey > endKey) return false;
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
    if (!o) continue;
    const dateKey = normalizeLocalDateKey(o.date);
    if (!dateKey) continue;
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(o);
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

  let best = null;
  for (const o of list) {
    if (!o || typeof o.goalId !== "string") continue;
    if (!best) {
      best = o;
      continue;
    }

    const rA = statusRank(o);
    const rB = statusRank(best);
    if (rA !== rB) {
      if (rA > rB) best = o;
      continue;
    }

    const aNoTime = isNoTimeOccurrence(o);
    const bNoTime = isNoTimeOccurrence(best);
    if (aNoTime !== bNoTime) {
      if (!aNoTime && bNoTime) best = o;
      continue;
    }

    // Prefer earliest start when both are timed
    if (!aNoTime && !bNoTime && typeof o.start === "string" && typeof best.start === "string") {
      if (o.start < best.start) best = o;
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

  let best = null;
  for (const o of list) {
    if (!o || typeof o.goalId !== "string") continue;
    if (!best) {
      best = o;
      continue;
    }

    const rA = statusRank(o);
    const rB = statusRank(best);
    if (rA !== rB) {
      if (rA > rB) best = o;
      continue;
    }

    const aNoTime = isNoTimeOccurrence(o);
    const bNoTime = isNoTimeOccurrence(best);
    if (aNoTime !== bNoTime) {
      if (!aNoTime && bNoTime) best = o;
      continue;
    }

    if (!aNoTime && !bNoTime && typeof o.start === "string" && typeof best.start === "string") {
      if (o.start < best.start) best = o;
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
  const list = Array.isArray(listAll) ? listAll.filter(Boolean) : [];

  let planned = 0;
  let done = 0;
  let skipped = 0;

  for (const o of list) {
    if (!o) continue;
    const st = typeof o.status === "string" ? o.status : "planned";

    if (st === "skipped" || st === "canceled") {
      if (includeSkipped) skipped += 1;
      continue; // never count skipped/canceled as planned
    }

    if (st === "done") done += 1;
    else planned += 1;
  }

  // Keep the same shape for all callers.
  return { planned, done, skipped };
}

/**
 * Premium calendar helper:
 * Returns a summary of categories present on a date so the UI can render:
 * - primary ring color (dominant/most important category)
 * - secondary dots (up to 3 categories)
 *
 * Output:
 * {
 *   primaryCategoryId,
 *   primaryColor,
 *   categoryIds,            // sorted by importance
 *   dots: [{ categoryId, color, openCount, totalCount }],
 *   countsByCategoryId: { [categoryId]: { openCount, doneCount, skippedCount, totalCount } },
 *   totals: { open, done, skipped, total }
 * }
 */
export function getDayCategorySummaryForDate(date, occurrencesSource, goals, categories, options = {}) {
  const { includeSkipped = false } = options;
  const occsAll = listOccurrencesByDate(date, occurrencesSource);
  const occs = Array.isArray(occsAll) ? occsAll.filter(Boolean) : [];

  const goalsById = buildIdMap(goals);
  const catsById = buildIdMap(categories);

  const countsByCategoryId = Object.create(null);
  let totalOpen = 0;
  let totalDone = 0;
  let totalSkipped = 0;
  let total = 0;

  for (const o of occs) {
    if (!o || typeof o.goalId !== "string") continue;
    const goal = goalsById[o.goalId];
    const catId = goal && typeof goal.categoryId === "string" ? goal.categoryId : null;
    if (!catId) continue;

    const st = typeof o.status === "string" ? o.status : "planned";
    if (!includeSkipped && (st === "skipped" || st === "canceled")) {
      continue;
    }

    if (!countsByCategoryId[catId]) {
      countsByCategoryId[catId] = { openCount: 0, doneCount: 0, skippedCount: 0, totalCount: 0 };
    }

    const bucket = countsByCategoryId[catId];
    bucket.totalCount += 1;
    total += 1;

    if (st === "done") {
      bucket.doneCount += 1;
      totalDone += 1;
    } else if (st === "skipped" || st === "canceled") {
      bucket.skippedCount += 1;
      totalSkipped += 1;
    } else {
      bucket.openCount += 1;
      totalOpen += 1;
    }
  }

  const categoryIds = Object.keys(countsByCategoryId);

  // Rank categories: openCount desc, totalCount desc, name asc.
  categoryIds.sort((a, b) => {
    const A = countsByCategoryId[a];
    const B = countsByCategoryId[b];
    if ((B?.openCount || 0) !== (A?.openCount || 0)) return (B?.openCount || 0) - (A?.openCount || 0);
    if ((B?.totalCount || 0) !== (A?.totalCount || 0)) return (B?.totalCount || 0) - (A?.totalCount || 0);
    const an = (catsById[a]?.name || "").toString();
    const bn = (catsById[b]?.name || "").toString();
    return an.localeCompare(bn);
  });

  // Primary category: prefer the one with the most open items. If tie/none, fall back to the primary occurrence rule.
  let primaryCategoryId = categoryIds[0] || null;
  if (!primaryCategoryId) {
    const primaryGoalId = getPrimaryGoalIdForDateForCalendar(date, occurrencesSource, { includeSkipped });
    const g = primaryGoalId ? goalsById[primaryGoalId] : null;
    primaryCategoryId = g && typeof g.categoryId === "string" ? g.categoryId : null;
  }

  const primaryColor = primaryCategoryId ? (catsById[primaryCategoryId]?.color || null) : null;

  const dots = categoryIds.slice(0, 3).map((catId) => {
    const c = catsById[catId];
    const color = c && typeof c.color === "string" ? c.color : null;
    const bucket = countsByCategoryId[catId] || { openCount: 0, doneCount: 0, skippedCount: 0, totalCount: 0 };
    return { categoryId: catId, color, openCount: bucket.openCount, totalCount: bucket.totalCount };
  });

  return {
    primaryCategoryId,
    primaryColor,
    categoryIds,
    dots,
    countsByCategoryId,
    totals: { open: totalOpen, done: totalDone, skipped: totalSkipped, total },
  };
}

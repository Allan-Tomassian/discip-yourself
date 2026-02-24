import { normalizeLocalDateKey } from "../utils/dateKey";
import { selectOccurrencesInRange } from "./metrics";
import {
  OCCURRENCE_STATUS,
  isCompletedOccurrenceStatus,
  isExcludedFromExpectedOccurrenceStatus,
  isMissedOccurrenceStatus,
  normalizeOccurrenceStatus,
} from "./occurrenceStatus";

export const MICRO_ACTION_WEIGHT = 0.25;

function normalizeStatus(raw) {
  return normalizeOccurrenceStatus(raw);
}

function isAnytimeLegacyOccurrence(occ) {
  if (!occ || typeof occ !== "object") return false;
  const hasNoTimeFlag = occ.noTime === true;
  const hasZeroStart = typeof occ.start === "string" && occ.start === "00:00";
  const hasWindowBounds = Boolean(occ.windowStartAt || occ.windowEndAt);
  return (hasNoTimeFlag || hasZeroStart) && !hasWindowBounds;
}

function toSafeDateKey(value) {
  return normalizeLocalDateKey(value || "");
}

function isInWindow(dateKey, fromKey, toKey) {
  if (!dateKey || !fromKey || !toKey) return false;
  return dateKey >= fromKey && dateKey <= toKey;
}

function countDailyMicroActions(bucket) {
  if (!bucket || typeof bucket !== "object") return 0;
  return Math.max(0, Math.min(3, Object.keys(bucket).length));
}

export function selectOccurrencesWindow(state, fromKey, toKey, filters = {}) {
  return selectOccurrencesInRange(state, fromKey, toKey, filters);
}

export function computeExpectedDoneMissed(occurrences) {
  const list = Array.isArray(occurrences) ? occurrences : [];

  const stats = {
    expected: 0,
    done: 0,
    missed: 0,
    canceled: 0,
    planned: 0,
    remaining: 0,
  };

  for (const occ of list) {
    if (!occ || typeof occ !== "object") continue;
    if (isAnytimeLegacyOccurrence(occ)) continue;

    const status = normalizeStatus(occ.status);
    const isCanceled = isExcludedFromExpectedOccurrenceStatus(status);
    const isDone = isCompletedOccurrenceStatus(status);
    const isMissed = isMissedOccurrenceStatus(status);
    const isExpected = !isCanceled;

    if (isExpected) stats.expected += 1;
    if (isDone) stats.done += 1;
    if (isMissed) stats.missed += 1;
    if (isCanceled) stats.canceled += 1;
    if (status === OCCURRENCE_STATUS.PLANNED) stats.planned += 1;
    if (isExpected && !isDone) stats.remaining += 1;
  }

  return stats;
}

export function computeDisciplineRate({ done = 0, expected = 0 } = {}) {
  const safeDone = Number.isFinite(done) ? Math.max(0, done) : 0;
  const safeExpected = Number.isFinite(expected) ? Math.max(0, expected) : 0;
  if (safeExpected <= 0) return 0;
  return safeDone / safeExpected;
}

export function computeMicroActionContribution(state, fromKey, toKey, { weight = MICRO_ACTION_WEIGHT } = {}) {
  const safeFrom = toSafeDateKey(fromKey);
  const safeTo = toSafeDateKey(toKey);
  const safeWeight = Number.isFinite(weight) ? Math.max(0, weight) : MICRO_ACTION_WEIGHT;
  const microChecks = state?.microChecks && typeof state.microChecks === "object" ? state.microChecks : {};

  if (!safeFrom || !safeTo || safeTo < safeFrom) {
    return {
      expected: 0,
      done: 0,
      rawDone: 0,
      weight: safeWeight,
    };
  }

  let rawDone = 0;
  for (const [dateKey, bucket] of Object.entries(microChecks)) {
    const safeDate = toSafeDateKey(dateKey);
    if (!isInWindow(safeDate, safeFrom, safeTo)) continue;
    rawDone += countDailyMicroActions(bucket);
  }

  const weighted = rawDone * safeWeight;

  return {
    expected: weighted,
    done: weighted,
    rawDone,
    weight: safeWeight,
  };
}

export function computeWindowStats(state, fromKey, toKey, options = {}) {
  const safeFrom = toSafeDateKey(fromKey);
  const safeTo = toSafeDateKey(toKey);
  const filters = options?.filters && typeof options.filters === "object" ? options.filters : {};
  const includeMicroContribution = options?.includeMicroContribution !== false;

  if (!safeFrom || !safeTo || safeTo < safeFrom) {
    return {
      window: { fromKey: safeFrom || "", toKey: safeTo || "" },
      occurrenceCount: 0,
      occurrences: {
        expected: 0,
        done: 0,
        missed: 0,
        canceled: 0,
        planned: 0,
        remaining: 0,
      },
      micro: {
        expected: 0,
        done: 0,
        rawDone: 0,
        weight: MICRO_ACTION_WEIGHT,
      },
      discipline: {
        expected: 0,
        done: 0,
        rate: 0,
        score: 0,
      },
    };
  }

  const windowOccurrences = selectOccurrencesWindow(state, safeFrom, safeTo, filters);
  const occurrenceStats = computeExpectedDoneMissed(windowOccurrences);
  const microContribution = includeMicroContribution
    ? computeMicroActionContribution(state, safeFrom, safeTo, { weight: options?.microWeight })
    : { expected: 0, done: 0, rawDone: 0, weight: MICRO_ACTION_WEIGHT };

  const disciplineDone = occurrenceStats.done + microContribution.done;
  const disciplineExpected = occurrenceStats.expected + microContribution.expected;
  const disciplineRate = computeDisciplineRate({ done: disciplineDone, expected: disciplineExpected });

  return {
    window: { fromKey: safeFrom, toKey: safeTo },
    occurrenceCount: windowOccurrences.length,
    occurrences: occurrenceStats,
    micro: microContribution,
    discipline: {
      expected: disciplineExpected,
      done: disciplineDone,
      rate: disciplineRate,
      score: Math.round(disciplineRate * 100),
    },
  };
}

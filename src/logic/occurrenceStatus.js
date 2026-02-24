export const OCCURRENCE_STATUS = Object.freeze({
  PLANNED: "planned",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  MISSED: "missed",
  SKIPPED: "skipped",
  CANCELED: "canceled",
  RESCHEDULED: "rescheduled",
});

const LEGACY_STATUS_ALIASES = Object.freeze({
  cancelled: OCCURRENCE_STATUS.CANCELED,
});

export const CANONICAL_OCCURRENCE_STATUSES = new Set([
  OCCURRENCE_STATUS.PLANNED,
  OCCURRENCE_STATUS.IN_PROGRESS,
  OCCURRENCE_STATUS.DONE,
  OCCURRENCE_STATUS.MISSED,
  OCCURRENCE_STATUS.SKIPPED,
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.RESCHEDULED,
]);

export const FINAL_OCCURRENCE_STATUSES = new Set([
  OCCURRENCE_STATUS.DONE,
  OCCURRENCE_STATUS.SKIPPED,
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.MISSED,
  OCCURRENCE_STATUS.RESCHEDULED,
]);

export const EXPECTED_OCCURRENCE_STATUSES = new Set([
  OCCURRENCE_STATUS.PLANNED,
  OCCURRENCE_STATUS.IN_PROGRESS,
  OCCURRENCE_STATUS.DONE,
  OCCURRENCE_STATUS.MISSED,
  OCCURRENCE_STATUS.RESCHEDULED,
]);

export const CANCELED_OCCURRENCE_STATUSES = new Set([
  OCCURRENCE_STATUS.SKIPPED,
  OCCURRENCE_STATUS.CANCELED,
]);

const STATUS_RANK = Object.freeze({
  [OCCURRENCE_STATUS.DONE]: 7,
  [OCCURRENCE_STATUS.MISSED]: 6,
  [OCCURRENCE_STATUS.RESCHEDULED]: 5,
  [OCCURRENCE_STATUS.SKIPPED]: 4,
  [OCCURRENCE_STATUS.CANCELED]: 4,
  [OCCURRENCE_STATUS.IN_PROGRESS]: 3,
  [OCCURRENCE_STATUS.PLANNED]: 2,
});

export function normalizeOccurrenceStatus(raw, fallback = OCCURRENCE_STATUS.PLANNED) {
  const normalizedFallback = CANONICAL_OCCURRENCE_STATUSES.has(fallback)
    ? fallback
    : OCCURRENCE_STATUS.PLANNED;
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) return normalizedFallback;
  const alias = LEGACY_STATUS_ALIASES[value];
  if (alias) return alias;
  return CANONICAL_OCCURRENCE_STATUSES.has(value) ? value : normalizedFallback;
}

export function isTerminalOccurrenceStatus(status) {
  return FINAL_OCCURRENCE_STATUSES.has(normalizeOccurrenceStatus(status));
}

export function isExpectedOccurrenceStatus(status) {
  return EXPECTED_OCCURRENCE_STATUSES.has(normalizeOccurrenceStatus(status));
}

export function isCompletedOccurrenceStatus(status) {
  return normalizeOccurrenceStatus(status) === OCCURRENCE_STATUS.DONE;
}

export function isMissedOccurrenceStatus(status) {
  return normalizeOccurrenceStatus(status) === OCCURRENCE_STATUS.MISSED;
}

export function isExcludedFromExpectedOccurrenceStatus(status) {
  return CANCELED_OCCURRENCE_STATUSES.has(normalizeOccurrenceStatus(status));
}

export function isPlannedOccurrenceStatus(status) {
  return normalizeOccurrenceStatus(status) === OCCURRENCE_STATUS.PLANNED;
}

export function getOccurrenceStatusRank(status) {
  const normalized = normalizeOccurrenceStatus(status);
  return STATUS_RANK[normalized] || 0;
}

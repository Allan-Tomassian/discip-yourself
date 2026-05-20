import { normalizeLocalDateKey } from "../utils/dateKey";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "./occurrenceStatus";

// Derived surface status layer only. Persistence stays split between
// occurrence.status and sessionHistory execution outcomes.
export const EXECUTION_SURFACE_STATUS = Object.freeze({
  PLANNED: "planned",
  ACTIVE: "active",
  DONE: "done",
  MISSED: "missed",
  SKIPPED: "skipped",
  CANCELED: "canceled",
  POSTPONED: "postponed",
  BLOCKED: "blocked",
  REPORTED: "reported",
});

export const EXECUTION_STATUS_SOURCE = Object.freeze({
  ACTIVE_SESSION: "activeSession",
  OCCURRENCE: "occurrence",
  SESSION_HISTORY: "sessionHistory",
  DEFAULT: "default",
});

export const EXECUTION_STATUS_ISSUE_CODE = Object.freeze({
  DONE_HISTORY_WITHOUT_DONE_OCCURRENCE: "DONE_HISTORY_WITHOUT_DONE_OCCURRENCE",
  CANCELED_HISTORY_WITHOUT_TERMINAL_OCCURRENCE: "CANCELED_HISTORY_WITHOUT_TERMINAL_OCCURRENCE",
});

const OPEN_SESSION_PHASES = new Set(["in_progress", "paused"]);
const FINAL_HISTORY_REASONS = new Set(["done", "blocked", "reported", "canceled"]);

const SURFACE_STATUSES = new Set(Object.values(EXECUTION_SURFACE_STATUS));
const TERMINAL_SURFACE_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.DONE,
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.SKIPPED,
  EXECUTION_SURFACE_STATUS.CANCELED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
]);
const EXECUTABLE_SURFACE_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.PLANNED,
  EXECUTION_SURFACE_STATUS.ACTIVE,
  EXECUTION_SURFACE_STATUS.BLOCKED,
  EXECUTION_SURFACE_STATUS.REPORTED,
]);
const FRICTION_SURFACE_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
  EXECUTION_SURFACE_STATUS.BLOCKED,
  EXECUTION_SURFACE_STATUS.REPORTED,
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSurfaceStatus(status) {
  const value = safeString(status).toLowerCase();
  return SURFACE_STATUSES.has(value) ? value : EXECUTION_SURFACE_STATUS.PLANNED;
}

function normalizeHistoryReason(value) {
  const reason = safeString(value).toLowerCase();
  return FINAL_HISTORY_REASONS.has(reason) ? reason : "";
}

function getOccurrenceId(occurrence) {
  return safeString(occurrence?.id);
}

function getHistoryId(history) {
  return safeString(history?.id);
}

function getHistoryOccurrenceId(history) {
  return safeString(history?.occurrenceId);
}

function getHistoryDateKey(history) {
  return (
    normalizeLocalDateKey(history?.dateKey) ||
    normalizeLocalDateKey(history?.date) ||
    normalizeLocalDateKey(history?.endAt) ||
    normalizeLocalDateKey(history?.startAt) ||
    ""
  );
}

function isEndedHistory(history) {
  return history?.state === "ended" || Boolean(normalizeHistoryReason(history?.endedReason));
}

function parseTimeRank(value) {
  const raw = safeString(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getHistoryRank(history) {
  const candidates = [history?.endAt, history?.finishedAt, history?.updatedAt, history?.createdAt, history?.startAt];
  for (const candidate of candidates) {
    const rank = parseTimeRank(candidate);
    if (rank !== null) return rank;
  }
  return 0;
}

function isOpenActiveSessionForOccurrence(activeSession, occurrenceId) {
  if (!activeSession || typeof activeSession !== "object") return false;
  const sessionOccurrenceId = safeString(activeSession.occurrenceId);
  if (!occurrenceId || sessionOccurrenceId !== occurrenceId) return false;

  const phase = safeString(activeSession.runtimePhase).toLowerCase();
  if (OPEN_SESSION_PHASES.has(phase)) return true;

  const legacyStatus = safeString(activeSession.status).toLowerCase();
  if (legacyStatus === "partial") return true;

  return activeSession.timerRunning === true;
}

function buildIssue(code, message, history) {
  return {
    code,
    message,
    historyId: getHistoryId(history) || null,
    occurrenceId: getHistoryOccurrenceId(history) || null,
  };
}

function buildResult({
  status,
  source,
  reason,
  occurrenceId,
  historyId = null,
  issues = [],
}) {
  const normalizedStatus = normalizeSurfaceStatus(status);
  return {
    status: normalizedStatus,
    source: source || EXECUTION_STATUS_SOURCE.DEFAULT,
    reason: reason || "",
    occurrenceId: occurrenceId || "",
    historyId: historyId || null,
    issues,
    isTerminal: isTerminalExecutionStatus(normalizedStatus),
    isExecutable: isExecutableExecutionStatus(normalizedStatus),
    isFriction: isFrictionExecutionStatus(normalizedStatus),
  };
}

export function isTerminalExecutionStatus(status) {
  return TERMINAL_SURFACE_STATUSES.has(normalizeSurfaceStatus(status));
}

export function isExecutableExecutionStatus(status) {
  return EXECUTABLE_SURFACE_STATUSES.has(normalizeSurfaceStatus(status));
}

export function isFrictionExecutionStatus(status) {
  return FRICTION_SURFACE_STATUSES.has(normalizeSurfaceStatus(status));
}

export function getLatestSessionHistoryForOccurrence(sessionHistory, occurrenceId, options = {}) {
  const targetOccurrenceId = safeString(occurrenceId);
  if (!targetOccurrenceId) return null;

  const targetDateKey = normalizeLocalDateKey(options?.dateKey);
  const endedOnly = options?.endedOnly !== false;
  const reasons = Array.isArray(options?.reasons)
    ? new Set(options.reasons.map((reason) => normalizeHistoryReason(reason)).filter(Boolean))
    : null;

  let latest = null;
  let latestRank = Number.NEGATIVE_INFINITY;
  let latestIndex = -1;

  safeArray(sessionHistory).forEach((history, index) => {
    if (!history || typeof history !== "object") return;
    if (getHistoryOccurrenceId(history) !== targetOccurrenceId) return;
    if (endedOnly && !isEndedHistory(history)) return;
    if (targetDateKey && getHistoryDateKey(history) !== targetDateKey) return;

    const reason = normalizeHistoryReason(history.endedReason);
    if (reasons && !reasons.has(reason)) return;

    const rank = getHistoryRank(history);
    if (rank > latestRank || (rank === latestRank && index > latestIndex)) {
      latest = history;
      latestRank = rank;
      latestIndex = index;
    }
  });

  return latest;
}

export function deriveExecutionStatusForOccurrence(occurrence, context = {}) {
  return deriveExecutionStatus({
    occurrence,
    activeSession: context?.activeSession,
    sessionHistory: context?.sessionHistory,
    dateKey: context?.dateKey,
  });
}

export function deriveExecutionStatus({
  occurrence,
  activeSession = null,
  sessionHistory = [],
  dateKey = "",
} = {}) {
  const occurrenceId = getOccurrenceId(occurrence);
  const occurrenceDateKey = normalizeLocalDateKey(occurrence?.date);
  const relevantDateKey = normalizeLocalDateKey(dateKey) || occurrenceDateKey;

  if (isOpenActiveSessionForOccurrence(activeSession, occurrenceId)) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.ACTIVE,
      source: EXECUTION_STATUS_SOURCE.ACTIVE_SESSION,
      reason: "open_active_session",
      occurrenceId,
    });
  }

  const occurrenceStatus = normalizeOccurrenceStatus(occurrence?.status);
  if (occurrenceStatus === OCCURRENCE_STATUS.DONE) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.DONE,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_done",
      occurrenceId,
    });
  }
  if (occurrenceStatus === OCCURRENCE_STATUS.MISSED) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.MISSED,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_missed",
      occurrenceId,
    });
  }
  if (occurrenceStatus === OCCURRENCE_STATUS.SKIPPED) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.SKIPPED,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_skipped",
      occurrenceId,
    });
  }
  if (occurrenceStatus === OCCURRENCE_STATUS.CANCELED) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.CANCELED,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_canceled",
      occurrenceId,
    });
  }
  if (occurrenceStatus === OCCURRENCE_STATUS.RESCHEDULED) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.POSTPONED,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_rescheduled",
      occurrenceId,
    });
  }
  if (occurrenceStatus === OCCURRENCE_STATUS.IN_PROGRESS) {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.ACTIVE,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "occurrence_in_progress",
      occurrenceId,
    });
  }

  const latestHistory = getLatestSessionHistoryForOccurrence(sessionHistory, occurrenceId, {
    dateKey: relevantDateKey,
  });
  const historyReason = normalizeHistoryReason(latestHistory?.endedReason);

  if (historyReason === "blocked") {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.BLOCKED,
      source: EXECUTION_STATUS_SOURCE.SESSION_HISTORY,
      reason: "history_blocked",
      occurrenceId,
      historyId: getHistoryId(latestHistory),
    });
  }
  if (historyReason === "reported") {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.REPORTED,
      source: EXECUTION_STATUS_SOURCE.SESSION_HISTORY,
      reason: "history_reported",
      occurrenceId,
      historyId: getHistoryId(latestHistory),
    });
  }
  if (historyReason === "canceled") {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.CANCELED,
      source: EXECUTION_STATUS_SOURCE.SESSION_HISTORY,
      reason: "history_canceled",
      occurrenceId,
      historyId: getHistoryId(latestHistory),
      issues: [
        buildIssue(
          EXECUTION_STATUS_ISSUE_CODE.CANCELED_HISTORY_WITHOUT_TERMINAL_OCCURRENCE,
          "Session history says this block was canceled while the occurrence is still planned.",
          latestHistory
        ),
      ],
    });
  }
  if (historyReason === "done") {
    return buildResult({
      status: EXECUTION_SURFACE_STATUS.PLANNED,
      source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
      reason: "history_done_without_done_occurrence",
      occurrenceId,
      historyId: getHistoryId(latestHistory),
      issues: [
        buildIssue(
          EXECUTION_STATUS_ISSUE_CODE.DONE_HISTORY_WITHOUT_DONE_OCCURRENCE,
          "Session history says this block was done while the occurrence is not done.",
          latestHistory
        ),
      ],
    });
  }

  return buildResult({
    status: EXECUTION_SURFACE_STATUS.PLANNED,
    source: EXECUTION_STATUS_SOURCE.OCCURRENCE,
    reason: "occurrence_planned",
    occurrenceId,
  });
}

export function getSessionFrictionSignalsForDate({ sessionHistory, dateKey } = {}) {
  const targetDateKey = normalizeLocalDateKey(dateKey);
  return safeArray(sessionHistory)
    .filter((history) => {
      if (!history || typeof history !== "object") return false;
      if (!isEndedHistory(history)) return false;
      if (targetDateKey && getHistoryDateKey(history) !== targetDateKey) return false;
      const reason = normalizeHistoryReason(history.endedReason);
      return reason === "blocked" || reason === "reported";
    })
    .map((history) => {
      const reason = normalizeHistoryReason(history.endedReason);
      const status =
        reason === "blocked" ? EXECUTION_SURFACE_STATUS.BLOCKED : EXECUTION_SURFACE_STATUS.REPORTED;
      return {
        status,
        source: EXECUTION_STATUS_SOURCE.SESSION_HISTORY,
        reason: `history_${reason}`,
        occurrenceId: getHistoryOccurrenceId(history),
        historyId: getHistoryId(history) || null,
        dateKey: getHistoryDateKey(history),
        isTerminal: isTerminalExecutionStatus(status),
        isExecutable: isExecutableExecutionStatus(status),
        isFriction: isFrictionExecutionStatus(status),
      };
    });
}

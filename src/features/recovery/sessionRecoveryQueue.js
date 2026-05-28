import { normalizeLocalDateKey } from "../../utils/dateKey";
import { RECOVERY_CONTEXT } from "./recoveryTypes";

export const SESSION_RECOVERY_SOURCE = Object.freeze({
  BLOCK: "session_block",
  REPORT: "session_report",
});

const SESSION_RECOVERY_CONTEXTS = new Set([
  RECOVERY_CONTEXT.BLOCKED,
  RECOVERY_CONTEXT.REPORTED,
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSessionRecoveryContext(value) {
  const context = safeString(value).toLowerCase();
  return SESSION_RECOVERY_CONTEXTS.has(context) ? context : "";
}

function defaultSourceForContext(context) {
  if (context === RECOVERY_CONTEXT.BLOCKED) return SESSION_RECOVERY_SOURCE.BLOCK;
  if (context === RECOVERY_CONTEXT.REPORTED) return SESSION_RECOVERY_SOURCE.REPORT;
  return "";
}

function expectedHistoryReason(context) {
  if (context === RECOVERY_CONTEXT.BLOCKED) return "blocked";
  if (context === RECOVERY_CONTEXT.REPORTED) return "reported";
  return "";
}

export function createSessionRecoveryRequest({
  occurrenceId,
  context,
  source = "",
  selectedDateKey = "",
  queuedAtMs = Date.now(),
} = {}) {
  const normalizedContext = normalizeSessionRecoveryContext(context);
  const normalizedOccurrenceId = safeString(occurrenceId);
  if (!normalizedContext || !normalizedOccurrenceId) return null;
  return {
    id: `${defaultSourceForContext(normalizedContext) || "session_recovery"}:${normalizedOccurrenceId}:${queuedAtMs}`,
    occurrenceId: normalizedOccurrenceId,
    context: normalizedContext,
    source: safeString(source) || defaultSourceForContext(normalizedContext),
    selectedDateKey: normalizeLocalDateKey(selectedDateKey) || "",
    queuedAtMs,
  };
}

export function hasCommittedSessionRecoveryOutcome(state, request) {
  const occurrenceId = safeString(request?.occurrenceId);
  const reason = expectedHistoryReason(normalizeSessionRecoveryContext(request?.context));
  if (!occurrenceId || !reason) return false;
  return safeArray(state?.sessionHistory).some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    if (safeString(entry.occurrenceId) !== occurrenceId) return false;
    if (safeString(entry.endedReason).toLowerCase() !== reason) return false;
    return entry.state === "ended" || Boolean(entry.endAt) || Boolean(entry.endedReason);
  });
}

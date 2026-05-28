import { NOTIFICATION_TYPE } from "../notifications/notificationTypes";
import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
  getSessionFrictionSignalsForDate,
} from "../../logic/executionStatus";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "../../logic/occurrenceStatus";
import {
  normalizeLocalDateKey,
  parseTimeToMinutes,
  toLocalDateKey,
} from "../../utils/datetime";
import { buildRecoveryContext } from "./recoverySheetModel";
import { RECOVERY_CONTEXT, RECOVERY_OPTION_TYPE } from "./recoveryTypes";

export const RECOVERABLE_HOME_PRIMARY_STATUSES = Object.freeze([
  RECOVERY_CONTEXT.LATE,
  RECOVERY_CONTEXT.MISSED,
  RECOVERY_CONTEXT.BLOCKED,
  RECOVERY_CONTEXT.REPORTED,
  RECOVERY_CONTEXT.POSTPONED,
]);

const HOME_RECOVERY_CONTEXT_BY_STATUS = Object.freeze({
  late: RECOVERY_CONTEXT.LATE,
  missed: RECOVERY_CONTEXT.MISSED,
  blocked: RECOVERY_CONTEXT.BLOCKED,
  reported: RECOVERY_CONTEXT.REPORTED,
  postponed: RECOVERY_CONTEXT.POSTPONED,
});

const RECOVERY_NOTIFICATION_CONTEXT_BY_TYPE = Object.freeze({
  [NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY]: RECOVERY_CONTEXT.LATE,
  [NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY]: RECOVERY_CONTEXT.MISSED,
});

const ADJUST_RECOVERY_CONTEXT_PRIORITY = Object.freeze([
  RECOVERY_CONTEXT.LATE,
  RECOVERY_CONTEXT.BLOCKED,
  RECOVERY_CONTEXT.MISSED,
  RECOVERY_CONTEXT.REPORTED,
  RECOVERY_CONTEXT.POSTPONED,
]);

const PLANNING_CONTEXT_BY_STATUS = Object.freeze({
  late: RECOVERY_CONTEXT.LATE,
  missed: RECOVERY_CONTEXT.MISSED,
  blocked: RECOVERY_CONTEXT.BLOCKED,
  reported: RECOVERY_CONTEXT.REPORTED,
  postponed: RECOVERY_CONTEXT.POSTPONED,
});

const POSTPONED_SAFE_OPTION_TYPES = new Set([
  RECOVERY_OPTION_TYPE.REDUCE_DURATION,
  RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
  RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
  RECOVERY_OPTION_TYPE.SKIP_ONCE,
]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNow(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function getOccurrences(state) {
  return safeArray(state?.occurrences);
}

function getOccurrenceById(state, occurrenceId) {
  const id = safeString(occurrenceId);
  return id ? getOccurrences(state).find((occurrence) => occurrence?.id === id) || null : null;
}

function getActiveSession(state) {
  return state?.ui?.activeSession && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;
}

function getOccurrenceStart(occurrence) {
  return safeString(occurrence?.start) || safeString(occurrence?.slotKey) || "09:00";
}

function getOccurrenceDuration(occurrence) {
  const raw = Number(occurrence?.durationMinutes);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
}

function nowMinutes(now) {
  const current = safeNow(now);
  return (current.getHours() * 60) + current.getMinutes();
}

function isLateOccurrence(occurrence, now, selectedDateKey) {
  if (normalizeOccurrenceStatus(occurrence?.status) !== OCCURRENCE_STATUS.PLANNED) return false;
  const current = safeNow(now);
  const dateKey = normalizeDateKey(selectedDateKey) || normalizeDateKey(occurrence?.date);
  if (!dateKey || dateKey !== toLocalDateKey(current)) return false;
  const startMinutes = parseTimeToMinutes(getOccurrenceStart(occurrence));
  if (!Number.isFinite(startMinutes)) return false;
  const endMinutes = startMinutes + getOccurrenceDuration(occurrence);
  return endMinutes > 0 ? endMinutes < nowMinutes(current) : startMinutes < nowMinutes(current);
}

function dedupeOccurrenceIds(ids, state) {
  const seen = new Set();
  const out = [];
  for (const rawId of safeArray(ids)) {
    const id = safeString(rawId);
    if (!id || seen.has(id) || !getOccurrenceById(state, id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function getEnabledRecoveryOptions(model) {
  return safeArray(model?.options).filter((option) => option && !option.disabled);
}

function hasUsableRecoveryOptions(model) {
  return Boolean(model?.ok && getEnabledRecoveryOptions(model).length > 0);
}

function hasSafePostponedRepairOption(model) {
  return getEnabledRecoveryOptions(model).some((option) => POSTPONED_SAFE_OPTION_TYPES.has(option?.type));
}

function buildValidatedRecoveryRequest({
  state,
  occurrenceId,
  context,
  selectedDateKey,
  now,
  source,
  originTab,
  successTab,
} = {}) {
  const model = buildRecoveryContext({
    state,
    occurrenceId,
    context,
    selectedDateKey,
    now,
    source,
  });
  if (!hasUsableRecoveryOptions(model)) return null;
  if (model.context === RECOVERY_CONTEXT.POSTPONED && !hasSafePostponedRepairOption(model)) return null;
  return {
    occurrenceId: model.request.occurrenceId,
    context: model.request.context,
    source,
    selectedDateKey: model.request.selectedDateKey || normalizeDateKey(selectedDateKey),
    originTab,
    successTab,
  };
}

function isPostponedOccurrence(occurrence) {
  const normalized = normalizeOccurrenceStatus(occurrence?.status);
  const raw = safeString(occurrence?.status).toLowerCase();
  return normalized === OCCURRENCE_STATUS.RESCHEDULED || raw === "postponed" || raw === "reported";
}

function deriveSurfaceStatus(state, occurrence) {
  return deriveExecutionStatusForOccurrence(occurrence, {
    activeSession: getActiveSession(state),
    sessionHistory: state?.sessionHistory,
    dateKey: occurrence?.date,
  }).status;
}

function occurrenceIdsForAdjustContext({ state, selectedDateKey, now, context }) {
  const dateKey = normalizeDateKey(selectedDateKey);
  const occurrences = getOccurrences(state);
  if (context === RECOVERY_CONTEXT.LATE) {
    return dedupeOccurrenceIds(
      occurrences
        .filter((occurrence) => normalizeDateKey(occurrence?.date) === dateKey)
        .filter((occurrence) => deriveSurfaceStatus(state, occurrence) === EXECUTION_SURFACE_STATUS.PLANNED)
        .filter((occurrence) => isLateOccurrence(occurrence, now, dateKey))
        .map((occurrence) => occurrence.id),
      state
    );
  }
  if (context === RECOVERY_CONTEXT.BLOCKED || context === RECOVERY_CONTEXT.REPORTED) {
    const targetStatus =
      context === RECOVERY_CONTEXT.BLOCKED
        ? EXECUTION_SURFACE_STATUS.BLOCKED
        : EXECUTION_SURFACE_STATUS.REPORTED;
    return dedupeOccurrenceIds(
      getSessionFrictionSignalsForDate({ sessionHistory: state?.sessionHistory, dateKey })
        .filter((signal) => signal.status === targetStatus)
        .map((signal) => signal.occurrenceId),
      state
    );
  }
  if (context === RECOVERY_CONTEXT.MISSED) {
    return dedupeOccurrenceIds(
      occurrences
        .filter((occurrence) => normalizeDateKey(occurrence?.date) === dateKey)
        .filter((occurrence) => deriveSurfaceStatus(state, occurrence) === EXECUTION_SURFACE_STATUS.MISSED)
        .map((occurrence) => occurrence.id),
      state
    );
  }
  if (context === RECOVERY_CONTEXT.POSTPONED) {
    return dedupeOccurrenceIds(
      occurrences
        .filter((occurrence) => normalizeDateKey(occurrence?.date) === dateKey)
        .filter((occurrence) => isPostponedOccurrence(occurrence))
        .map((occurrence) => occurrence.id),
      state
    );
  }
  return [];
}

function parseOccurrenceIdFromRoute(route) {
  const raw = safeString(route);
  if (!raw.startsWith("/session")) return "";
  return raw.split("/").filter(Boolean)[1] || "";
}

export function resolveHomePrimaryRecoveryRequest(primaryAction) {
  const status = safeString(primaryAction?.status).toLowerCase();
  const context = HOME_RECOVERY_CONTEXT_BY_STATUS[status];
  const occurrenceId = safeString(primaryAction?.occurrenceId);
  if (!context || !occurrenceId) return null;
  return {
    occurrenceId,
    context,
    source: "home_primary",
  };
}

export function resolveNotificationRecoveryRequest(notification) {
  const type = safeString(notification?.type);
  const context = RECOVERY_NOTIFICATION_CONTEXT_BY_TYPE[type];
  if (!context) return null;
  const occurrenceId =
    safeString(notification?.targetId) ||
    safeString(notification?.occurrenceId) ||
    parseOccurrenceIdFromRoute(notification?.targetRoute);
  if (!occurrenceId) return null;
  return {
    occurrenceId,
    context,
    source: "notification",
    notificationId: safeString(notification?.notificationId) || safeString(notification?.id),
    notificationType: type,
  };
}

export function isRecoveryNotification(notification) {
  return Boolean(resolveNotificationRecoveryRequest(notification));
}

export function resolveAdjustRecoveryRequest({
  diagnostic,
  state,
  selectedDateKey,
  now,
} = {}) {
  if (!diagnostic || typeof diagnostic !== "object") return null;
  const dateKey =
    normalizeDateKey(selectedDateKey) ||
    normalizeDateKey(diagnostic?.summary?.activeDateKey);
  if (!dateKey) return null;

  for (const context of ADJUST_RECOVERY_CONTEXT_PRIORITY) {
    const occurrenceIds = occurrenceIdsForAdjustContext({
      state,
      selectedDateKey: dateKey,
      now,
      context,
    });
    if (occurrenceIds.length > 1) return null;
    if (occurrenceIds.length !== 1) continue;

    const request = buildValidatedRecoveryRequest({
      state,
      occurrenceId: occurrenceIds[0],
      context,
      selectedDateKey: dateKey,
      now,
      source: "adjust",
      originTab: "adjust",
      successTab: "today",
    });
    if (request) return request;
  }

  return null;
}

export function resolvePlanningEntryRecoveryRequest({
  entry,
  state,
  selectedDateKey,
  now,
} = {}) {
  const occurrence = entry?.targetOccurrence || entry?.occurrence || null;
  const occurrenceId = safeString(occurrence?.id) || safeString(entry?.occurrenceId);
  if (!occurrenceId) return null;

  const status = safeString(entry?.status).toLowerCase();
  const context =
    PLANNING_CONTEXT_BY_STATUS[status] ||
    (status === EXECUTION_SURFACE_STATUS.PLANNED && isLateOccurrence(occurrence, now, selectedDateKey)
      ? RECOVERY_CONTEXT.LATE
      : "");
  if (!context) return null;

  return buildValidatedRecoveryRequest({
    state,
    occurrenceId,
    context,
    selectedDateKey,
    now,
    source: "planning",
    originTab: "timeline",
    successTab: "timeline",
  });
}

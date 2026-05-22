import { deriveExecutionStatus, EXECUTION_SURFACE_STATUS } from "../../logic/executionStatus";
import { normalizeLocalDateKey, normalizeStartTime, parseTimeToMinutes, toLocalDateKey } from "../../utils/datetime";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TARGET_TYPE,
  NOTIFICATION_TYPE,
} from "./notificationTypes";

const START_SOON_WINDOW_MINUTES = 15;
const START_NOW_GRACE_MINUTES = 5;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getStateArray(state, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), state);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function getOccurrences(state) {
  return getStateArray(state, ["occurrences", "planning.occurrences", "data.occurrences"]);
}

function getSessionHistory(state) {
  return getStateArray(state, ["sessionHistory", "sessions.history", "ui.sessionHistory"]);
}

function getSystemSignals(state) {
  return getStateArray(state, ["systemSignals", "signals"]);
}

function getActiveSession(state) {
  return state?.activeSession || state?.ui?.activeSession || null;
}

function getOccurrenceId(occurrence) {
  return safeString(occurrence?.id);
}

function getOccurrenceDateKey(occurrence) {
  return normalizeLocalDateKey(occurrence?.date) || normalizeLocalDateKey(occurrence?.dateKey) || normalizeLocalDateKey(occurrence?.dayKey);
}

function getOccurrenceStartTime(occurrence) {
  return (
    normalizeStartTime(occurrence?.start) ||
    normalizeStartTime(occurrence?.startTime) ||
    normalizeStartTime(occurrence?.time) ||
    normalizeStartTime(occurrence?.plannedStart)
  );
}

function getOccurrenceTitle(occurrence) {
  return (
    safeString(occurrence?.title) ||
    safeString(occurrence?.label) ||
    safeString(occurrence?.actionTitle) ||
    safeString(occurrence?.name) ||
    "Bloc"
  );
}

function getActiveOccurrenceId(activeSession) {
  return safeString(activeSession?.occurrenceId) || safeString(activeSession?.occurrence?.id);
}

function buildScheduledIso(dateKey, time) {
  const normalizedDate = normalizeLocalDateKey(dateKey);
  const normalizedTime = normalizeStartTime(time);
  if (!normalizedDate || !normalizedTime) return "";
  const [year, month, day] = normalizedDate.split("-").map((part) => Number(part));
  const [hours, minutes] = normalizedTime.split(":").map((part) => Number(part));
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

function matchesSignalTarget(signal, occurrenceId) {
  if (!occurrenceId) return true;
  if (safeString(signal?.occurrenceId) === occurrenceId) return true;
  return safeArray(signal?.occurrenceIds).map(safeString).includes(occurrenceId);
}

function getSourceSignalIds(systemSignals, types, occurrenceId = "") {
  const allowed = new Set(safeArray(types));
  return safeArray(systemSignals)
    .filter((signal) => allowed.has(safeString(signal?.type)) && matchesSignalTarget(signal, occurrenceId))
    .map((signal) => safeString(signal?.id))
    .filter(Boolean);
}

function buildOccurrenceCandidate({
  type,
  priority,
  occurrence,
  dateKey,
  now,
  title,
  body,
  reason,
  sourceSignalIds = [],
}) {
  const occurrenceId = getOccurrenceId(occurrence);
  const startTime = getOccurrenceStartTime(occurrence);
  return {
    id: `${type}:${occurrenceId || "unknown"}:${dateKey}`,
    type,
    priority,
    title,
    body,
    targetRoute: `/session/${occurrenceId}`,
    targetType: NOTIFICATION_TARGET_TYPE.OCCURRENCE,
    targetId: occurrenceId,
    reason,
    scheduledFor: buildScheduledIso(dateKey, startTime) || now.toISOString(),
    cooldownKey: `${type}:${occurrenceId || dateKey}`,
    channelPreference: "any",
    sourceSignalIds,
    createdAt: now.toISOString(),
  };
}

function buildDayCandidate({ type, priority, dateKey, now, title, body, reason, sourceSignalIds = [] }) {
  return {
    id: `${type}:${dateKey}`,
    type,
    priority,
    title,
    body,
    targetRoute: "/coach",
    targetType: NOTIFICATION_TARGET_TYPE.DAY,
    targetId: dateKey,
    reason,
    scheduledFor: now.toISOString(),
    cooldownKey: `${type}:${dateKey}`,
    channelPreference: NOTIFICATION_CHANNEL.IN_APP,
    sourceSignalIds,
    createdAt: now.toISOString(),
  };
}

function compareCandidatePriority(a, b) {
  const rank = {
    [NOTIFICATION_PRIORITY.CRITICAL]: 4,
    [NOTIFICATION_PRIORITY.HIGH]: 3,
    [NOTIFICATION_PRIORITY.MEDIUM]: 2,
    [NOTIFICATION_PRIORITY.LOW]: 1,
  };
  const priorityDiff = (rank[b.priority] || 0) - (rank[a.priority] || 0);
  if (priorityDiff !== 0) return priorityDiff;
  return safeString(a.scheduledFor).localeCompare(safeString(b.scheduledFor));
}

export function buildNotificationCandidates({ state = {}, now = new Date() } = {}) {
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const dateKey = toLocalDateKey(current);
  const nowMinutes = current.getHours() * 60 + current.getMinutes();
  const occurrences = getOccurrences(state);
  const sessionHistory = getSessionHistory(state);
  const activeSession = getActiveSession(state);
  const activeOccurrenceId = getActiveOccurrenceId(activeSession);
  const systemSignals = getSystemSignals(state);

  const todaysOccurrences = occurrences.filter((occurrence) => getOccurrenceDateKey(occurrence) === dateKey);
  const candidates = [];

  todaysOccurrences.forEach((occurrence) => {
    const occurrenceId = getOccurrenceId(occurrence);
    if (occurrenceId && occurrenceId === activeOccurrenceId) return;

    const status = deriveExecutionStatus({
      occurrence,
      activeSession,
      sessionHistory,
      dateKey,
    }).status;

    const startTime = getOccurrenceStartTime(occurrence);
    const startMinutes = parseTimeToMinutes(startTime);
    const title = getOccurrenceTitle(occurrence);
    const deltaMinutes = Number.isFinite(startMinutes) ? startMinutes - nowMinutes : null;

    if (status === EXECUTION_SURFACE_STATUS.MISSED) {
      candidates.push(
        buildOccurrenceCandidate({
          type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY,
          priority: NOTIFICATION_PRIORITY.MEDIUM,
          occurrence,
          dateKey,
          now: current,
          title: "Bloc manqué",
          body: "Reprends sans dette avec un ajustement simple.",
          reason: "missed_block",
          sourceSignalIds: getSourceSignalIds(systemSignals, ["missed_block"], occurrenceId),
        }),
      );
      return;
    }

    if (status !== EXECUTION_SURFACE_STATUS.PLANNED || deltaMinutes === null) return;

    if (deltaMinutes > 0 && deltaMinutes <= START_SOON_WINDOW_MINUTES) {
      candidates.push(
        buildOccurrenceCandidate({
          type: NOTIFICATION_TYPE.BLOCK_START_SOON,
          priority: NOTIFICATION_PRIORITY.HIGH,
          occurrence,
          dateKey,
          now: current,
          title: "Bloc bientôt prêt",
          body: `${title} commence à ${startTime}.`,
          reason: "starts_in_15_minutes",
          sourceSignalIds: [],
        }),
      );
      return;
    }

    if (deltaMinutes <= 0 && deltaMinutes >= -START_NOW_GRACE_MINUTES) {
      candidates.push(
        buildOccurrenceCandidate({
          type: NOTIFICATION_TYPE.BLOCK_START_NOW,
          priority: NOTIFICATION_PRIORITY.HIGH,
          occurrence,
          dateKey,
          now: current,
          title: "C’est le moment",
          body: `Démarre ${title} ou ajuste le bloc.`,
          reason: "starts_now",
          sourceSignalIds: [],
        }),
      );
      return;
    }

    if (deltaMinutes < -START_NOW_GRACE_MINUTES) {
      candidates.push(
        buildOccurrenceCandidate({
          type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
          priority: NOTIFICATION_PRIORITY.HIGH,
          occurrence,
          dateKey,
          now: current,
          title: "Bloc à récupérer",
          body: "Repars avec une version plus simple.",
          reason: "overdue_block",
          sourceSignalIds: getSourceSignalIds(systemSignals, ["late_critical_block"], occurrenceId),
        }),
      );
    }
  });

  if (todaysOccurrences.length === 0) {
    candidates.push(
      buildDayCandidate({
        type: NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        dateKey,
        now: current,
        title: "Construis ton prochain bloc",
        body: "Ta journée a un espace libre.",
        reason: "empty_day_with_availability",
        sourceSignalIds: getSourceSignalIds(systemSignals, ["no_next_block"]),
      }),
    );
  }

  return candidates.sort(compareCandidatePriority);
}


import { uid } from "../utils/helpers";

function normalizeString(value) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function normalizeState(value) {
  return value === "ended" ? "ended" : "in_progress";
}

function normalizeEndedReason(value, state) {
  if (state !== "ended") return null;
  if (value === "canceled") return "canceled";
  if (value === "done") return "done";
  return null;
}

function normalizeForCompare(record) {
  const state = normalizeState(record?.state);
  return {
    id: normalizeString(record?.id),
    occurrenceId: normalizeString(record?.occurrenceId),
    actionId: normalizeString(record?.actionId),
    dateKey: normalizeString(record?.dateKey),
    startAt: normalizeString(record?.startAt),
    endAt: normalizeString(record?.endAt),
    state,
    endedReason: normalizeEndedReason(record?.endedReason, state) || "",
    timerSeconds: normalizeNumber(record?.timerSeconds),
    notes: normalizeString(record?.notes),
  };
}

function areSessionV2Equal(a, b) {
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  return (
    left.id === right.id &&
    left.occurrenceId === right.occurrenceId &&
    left.actionId === right.actionId &&
    left.dateKey === right.dateKey &&
    left.startAt === right.startAt &&
    left.endAt === right.endAt &&
    left.state === right.state &&
    left.endedReason === right.endedReason &&
    left.timerSeconds === right.timerSeconds &&
    left.notes === right.notes
  );
}

export function upsertSessionV2(list, record) {
  const sessions = Array.isArray(list) ? list : [];
  if (!record || typeof record !== "object") return sessions;
  const occurrenceId = normalizeString(record.occurrenceId);
  if (!occurrenceId) return sessions;

  const existingIndex = sessions.findIndex((s) => s && s.occurrenceId === occurrenceId);
  const existing = existingIndex >= 0 ? sessions[existingIndex] : null;

  const state = normalizeState(record.state);
  if (existing && existing.state === "ended" && state !== "ended") return sessions;

  const merged = {
    ...existing,
    ...record,
    id: record.id || existing?.id || uid(),
    occurrenceId,
    state,
    endedReason: normalizeEndedReason(record.endedReason, state),
    timerSeconds: normalizeNumber(record.timerSeconds),
  };

  if (existing && areSessionV2Equal(existing, merged)) return sessions;

  const next = sessions.slice();
  if (existingIndex >= 0) next[existingIndex] = merged;
  else next.push(merged);
  return next;
}

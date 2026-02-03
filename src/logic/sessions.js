import { uid } from "../utils/helpers";

const CLOSED_STATUSES = new Set(["done", "missed", "canceled", "rescheduled"]);

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function resolveSessions(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.sessions;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function resolveActionId(occ) {
  const actionId = typeof occ?.actionId === "string" ? occ.actionId : "";
  if (actionId) return actionId;
  return typeof occ?.goalId === "string" ? occ.goalId : "";
}

function getOccurrenceById(occurrences, occurrenceId) {
  if (!occurrenceId) return null;
  return occurrences.find((o) => o && o.id === occurrenceId) || null;
}

export function findSessionByOccurrenceId(sessions, occurrenceId) {
  if (!occurrenceId) return null;
  const list = resolveSessions(sessions);
  return list.find((s) => s && s.occurrenceId === occurrenceId) || null;
}

export function findActiveSession(sessions, activeSessionId) {
  const list = resolveSessions(sessions);
  if (activeSessionId) {
    const match = list.find((s) => s && s.id === activeSessionId) || null;
    if (match) return match;
  }
  return list.find((s) => s && s.state === "in_progress") || null;
}

export function canStartSessionForOccurrence(occurrence, sessions) {
  if (!occurrence) return false;
  const status = typeof occurrence.status === "string" ? occurrence.status : "planned";
  if (CLOSED_STATUSES.has(status)) return false;
  const existing = findSessionByOccurrenceId(sessions, occurrence.id);
  if (existing && existing.state === "ended") return false;
  return true;
}

export function startSessionForOccurrence(state, occurrenceId, now = new Date()) {
  if (!state || typeof state !== "object") return state;
  const occurrences = resolveOccurrences(state);
  const sessions = resolveSessions(state);
  const ui = state.ui && typeof state.ui === "object" ? state.ui : {};

  const occurrence = getOccurrenceById(occurrences, occurrenceId);
  if (!occurrence) return state;

  const activeSession = findActiveSession(sessions, ui.activeSessionId);
  if (activeSession && activeSession.state === "in_progress") {
    // Do not start a new one if another session is already running.
    if (activeSession.occurrenceId === occurrenceId) {
      return { ...state, ui: { ...ui, activeSessionId: activeSession.id } };
    }
    return { ...state, ui: { ...ui, activeSessionId: activeSession.id } };
  }

  const existing = findSessionByOccurrenceId(sessions, occurrenceId);
  if (existing) {
    if (existing.state === "ended") return state;
    return { ...state, ui: { ...ui, activeSessionId: existing.id } };
  }

  const status = typeof occurrence.status === "string" ? occurrence.status : "planned";
  if (CLOSED_STATUSES.has(status)) return state;

  const nowIso = now.toISOString();
  const actionId = resolveActionId(occurrence);
  const newSession = {
    id: uid(),
    occurrenceId,
    actionId,
    dateKey: occurrence.date || "",
    startAt: nowIso,
    endAt: null,
    state: "in_progress",
    endedReason: null,
    timerStartedAt: "",
    timerAccumulatedSec: 0,
    timerRunning: false,
    notes: "",
  };

  const nextOccurrences = occurrences.map((o) => {
    if (!o || o.id !== occurrenceId) return o;
    if (o.status !== "planned") return o;
    return { ...o, status: "in_progress", updatedAt: nowIso };
  });

  return {
    ...state,
    occurrences: nextOccurrences,
    sessions: [...sessions, newSession],
    ui: { ...ui, activeSessionId: newSession.id },
  };
}

export function endSession(state, sessionId, reason = "done", now = new Date()) {
  if (!state || typeof state !== "object") return state;
  const sessions = resolveSessions(state);
  const occurrences = resolveOccurrences(state);
  const ui = state.ui && typeof state.ui === "object" ? state.ui : {};
  const session = sessions.find((s) => s && s.id === sessionId) || null;
  if (!session) return state;
  if (session.state === "ended") return state;

  const nowIso = now.toISOString();
  const endedReason = reason === "canceled" ? "canceled" : "done";
  const nextSessions = sessions.map((s) =>
    s && s.id === sessionId
      ? {
          ...s,
          state: "ended",
          endedReason,
          endAt: nowIso,
          timerRunning: false,
          timerStartedAt: "",
        }
      : s
  );

  const nextOccurrences = occurrences.map((o) => {
    if (!o || o.id !== session.occurrenceId) return o;
    const nextStatus = endedReason === "done" ? "done" : "canceled";
    return { ...o, status: nextStatus, updatedAt: nowIso };
  });

  const nextUi = { ...ui };
  if (nextUi.activeSessionId === sessionId) nextUi.activeSessionId = null;

  return {
    ...state,
    sessions: nextSessions,
    occurrences: nextOccurrences,
    ui: nextUi,
  };
}

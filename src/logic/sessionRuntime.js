import { uid } from "../utils/helpers";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { setOccurrenceStatusById } from "./occurrences";
import { OCCURRENCE_STATUS, isTerminalOccurrenceStatus, normalizeOccurrenceStatus } from "./occurrenceStatus";
import { upsertSessionV2 } from "./sessionsV2";

export const SESSION_RUNTIME_EVENT = Object.freeze({
  START: "start",
  PAUSE: "pause",
  RESUME: "resume",
  FINISH: "finish",
  CANCEL: "cancel",
  BLOCK: "block",
  REPORT: "report",
});

export const SESSION_RUNTIME_PHASE = Object.freeze({
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  DONE: "done",
  CANCELED: "canceled",
  BLOCKED: "blocked",
  REPORTED: "reported",
});

const OPEN_PHASES = new Set([SESSION_RUNTIME_PHASE.IN_PROGRESS, SESSION_RUNTIME_PHASE.PAUSED]);
const FINAL_PHASES = new Set([
  SESSION_RUNTIME_PHASE.DONE,
  SESSION_RUNTIME_PHASE.CANCELED,
  SESSION_RUNTIME_PHASE.BLOCKED,
  SESSION_RUNTIME_PHASE.REPORTED,
]);

function normalizePhase(raw, session) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === SESSION_RUNTIME_PHASE.IN_PROGRESS || value === SESSION_RUNTIME_PHASE.PAUSED) return value;
  if (
    value === SESSION_RUNTIME_PHASE.DONE ||
    value === SESSION_RUNTIME_PHASE.CANCELED ||
    value === SESSION_RUNTIME_PHASE.BLOCKED ||
    value === SESSION_RUNTIME_PHASE.REPORTED
  ) {
    return value;
  }
  const status = typeof session?.status === "string" ? session.status.trim().toLowerCase() : "";
  if (status === "done") return SESSION_RUNTIME_PHASE.DONE;
  if (status === "skipped" || status === "canceled") return SESSION_RUNTIME_PHASE.CANCELED;
  if (status === "partial") {
    if (session?.timerRunning === true) return SESSION_RUNTIME_PHASE.IN_PROGRESS;
    const accumulated = Number.isFinite(session?.timerAccumulatedSec) ? session.timerAccumulatedSec : 0;
    return accumulated > 0 ? SESSION_RUNTIME_PHASE.PAUSED : SESSION_RUNTIME_PHASE.IN_PROGRESS;
  }
  return SESSION_RUNTIME_PHASE.IN_PROGRESS;
}

function toLegacyStatus(phase) {
  if (phase === SESSION_RUNTIME_PHASE.DONE) return "done";
  if (phase === SESSION_RUNTIME_PHASE.BLOCKED || phase === SESSION_RUNTIME_PHASE.REPORTED) return "skipped";
  if (phase === SESSION_RUNTIME_PHASE.CANCELED) return "skipped";
  return "partial";
}

function normalizeIdList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === "string" && id.trim());
}

function resolveOccurrences(state) {
  return Array.isArray(state?.occurrences) ? state.occurrences : [];
}

function resolveGoals(state) {
  return Array.isArray(state?.goals) ? state.goals : [];
}

function resolveActiveSession(state) {
  if (!state?.ui || typeof state.ui !== "object") return null;
  return state.ui.activeSession && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;
}

function resolveOccurrence(occurrences, occurrenceId) {
  if (!occurrenceId) return null;
  return occurrences.find((occ) => occ && occ.id === occurrenceId) || null;
}

function clampDurationSec(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function computeElapsedSec(session, nowMs) {
  const base = Number.isFinite(session?.timerAccumulatedSec) ? Math.max(0, Math.floor(session.timerAccumulatedSec)) : 0;
  if (!session?.timerRunning) return base;
  const startedMs = session?.timerStartedAt ? new Date(session.timerStartedAt).getTime() : NaN;
  if (!Number.isFinite(startedMs)) return base;
  const delta = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  return base + delta;
}

function withNextState(state, { activeSession, occurrences, sessionHistory }) {
  const prevUi = state?.ui && typeof state.ui === "object" ? state.ui : {};
  const sameSession = prevUi.activeSession === activeSession;
  const sameOccurrences = resolveOccurrences(state) === occurrences;
  const sameHistory = (Array.isArray(state?.sessionHistory) ? state.sessionHistory : []) === sessionHistory;
  if (sameSession && sameOccurrences && sameHistory) return state;
  return {
    ...state,
    occurrences,
    sessionHistory,
    ui: { ...prevUi, activeSession },
  };
}

function applyOccurrenceRuntimeStatus(occurrences, goals, occurrenceId, nextStatus) {
  const occurrence = resolveOccurrence(occurrences, occurrenceId);
  if (!occurrence) return occurrences;
  const currentStatus = normalizeOccurrenceStatus(occurrence.status);
  if (isTerminalOccurrenceStatus(currentStatus)) return occurrences;
  const normalizedTarget = normalizeOccurrenceStatus(nextStatus, currentStatus);
  if (currentStatus === normalizedTarget) return occurrences;
  return setOccurrenceStatusById(occurrenceId, normalizedTarget, { occurrences, goals });
}

function buildHistoryRecord({
  currentSession,
  occurrence,
  occurrenceId,
  dateKey,
  state,
  endedReason = null,
  nowIso,
  timerSeconds,
  feedbackLevel = "",
  feedbackText = "",
}) {
  const actionId =
    typeof occurrence?.goalId === "string"
      ? occurrence.goalId
      : typeof occurrence?.actionId === "string"
        ? occurrence.actionId
        : "";
  return {
    id: currentSession?.id || occurrenceId || uid(),
    occurrenceId,
    actionId,
    dateKey,
    startAt: currentSession?.startedAt || currentSession?.timerStartedAt || nowIso,
    endAt: state === "ended" ? nowIso : null,
    state,
    endedReason: state === "ended" ? endedReason : null,
    timerSeconds: clampDurationSec(timerSeconds),
    notes: typeof currentSession?.notes === "string" ? currentSession.notes : "",
    feedbackLevel: state === "ended" ? feedbackLevel || "" : "",
    feedbackText: state === "ended" ? feedbackText || "" : "",
  };
}

function buildBaseSession({
  current,
  occurrenceId,
  dateKey,
  objectiveId,
  habitIds,
  nowIso,
}) {
  const normalizedDateKey = normalizeLocalDateKey(dateKey) || todayLocalKey();
  const nextHabitIds = normalizeIdList(habitIds);
  return {
    id: current?.occurrenceId === occurrenceId && current?.id ? current.id : uid(),
    occurrenceId,
    dateKey: normalizedDateKey,
    objectiveId: objectiveId || null,
    habitIds: nextHabitIds,
    status: toLegacyStatus(SESSION_RUNTIME_PHASE.IN_PROGRESS),
    runtimePhase: SESSION_RUNTIME_PHASE.IN_PROGRESS,
    timerStartedAt: "",
    timerAccumulatedSec: 0,
    timerRunning: false,
    doneHabitIds: [],
    startedAt: current?.startedAt || nowIso,
  };
}

function isAllowedTransition(phase, eventType) {
  if (eventType === SESSION_RUNTIME_EVENT.START) return true;
  if (!phase) return false;
  if (eventType === SESSION_RUNTIME_EVENT.PAUSE) return phase === SESSION_RUNTIME_PHASE.IN_PROGRESS;
  if (eventType === SESSION_RUNTIME_EVENT.RESUME) return phase === SESSION_RUNTIME_PHASE.PAUSED || phase === SESSION_RUNTIME_PHASE.IN_PROGRESS;
  if (
    eventType === SESSION_RUNTIME_EVENT.FINISH ||
    eventType === SESSION_RUNTIME_EVENT.CANCEL ||
    eventType === SESSION_RUNTIME_EVENT.BLOCK ||
    eventType === SESSION_RUNTIME_EVENT.REPORT
  ) {
    return OPEN_PHASES.has(phase);
  }
  return false;
}

export function isRuntimeSessionOpen(session) {
  if (!session || typeof session !== "object") return false;
  const phase = normalizePhase(session.runtimePhase, session);
  return OPEN_PHASES.has(phase);
}

export function getOpenRuntimeSession(state) {
  const session = normalizeRuntimeSession(resolveActiveSession(state));
  return isRuntimeSessionOpen(session) ? session : null;
}

export function resolveRuntimeSessionGate(state, { occurrenceId = null } = {}) {
  const activeSession = getOpenRuntimeSession(state);
  if (!activeSession) {
    return {
      status: "ready",
      activeSession: null,
      activeOccurrenceId: null,
    };
  }

  const activeOccurrenceId =
    typeof activeSession.occurrenceId === "string" && activeSession.occurrenceId.trim()
      ? activeSession.occurrenceId
      : null;

  if (!occurrenceId || !activeOccurrenceId || activeOccurrenceId === occurrenceId) {
    return {
      status: "resume_active",
      activeSession,
      activeOccurrenceId,
    };
  }

  return {
    status: "blocked",
    activeSession,
    activeOccurrenceId,
  };
}

export function isRuntimeSessionFinal(session) {
  if (!session || typeof session !== "object") return false;
  const phase = normalizePhase(session.runtimePhase, session);
  return FINAL_PHASES.has(phase);
}

export function normalizeRuntimeSession(session) {
  if (!session || typeof session !== "object") return session;
  const phase = normalizePhase(session.runtimePhase, session);
  const status = toLegacyStatus(phase);
  if (session.runtimePhase === phase && session.status === status) return session;
  return { ...session, runtimePhase: phase, status };
}

export function resolveRuntimeAutoFinish(state, now = new Date()) {
  const session = normalizeRuntimeSession(resolveActiveSession(state));
  if (!session || !isRuntimeSessionOpen(session)) return null;
  if (!session.timerRunning) return null;
  const occurrenceId = typeof session.occurrenceId === "string" ? session.occurrenceId : "";
  if (!occurrenceId) return null;
  const occurrences = resolveOccurrences(state);
  const occurrence = resolveOccurrence(occurrences, occurrenceId);
  if (!occurrence) return null;
  const occStatus = normalizeOccurrenceStatus(occurrence.status);
  if (isTerminalOccurrenceStatus(occStatus)) return null;
  const durationMinutes = Number.isFinite(occurrence.durationMinutes) ? occurrence.durationMinutes : null;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  const nowMs = now.getTime();
  const elapsedSec = computeElapsedSec(session, nowMs);
  const targetSec = Math.max(0, Math.round(durationMinutes * 60));
  if (elapsedSec < targetSec) return null;
  return {
    type: SESSION_RUNTIME_EVENT.FINISH,
    occurrenceId,
    durationSec: elapsedSec,
    doneHabitIds: occurrence.goalId ? [occurrence.goalId] : [],
    dateKey: occurrence.date || session.dateKey || todayLocalKey(),
  };
}

export function applySessionRuntimeTransition(state, input = {}) {
  const type = typeof input?.type === "string" ? input.type : "";
  if (!type) return state;
  const prevState = state && typeof state === "object" ? state : {};
  const occurrences = resolveOccurrences(prevState);
  const goals = resolveGoals(prevState);
  const prevHistory = Array.isArray(prevState?.sessionHistory) ? prevState.sessionHistory : [];
  const prevUi = prevState?.ui && typeof prevState.ui === "object" ? prevState.ui : {};
  const currentRaw = resolveActiveSession(prevState);
  const current = normalizeRuntimeSession(currentRaw);
  const phase = normalizePhase(current?.runtimePhase, current);
  const now = input?.now instanceof Date ? input.now : new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  if (type === SESSION_RUNTIME_EVENT.START) {
    const occurrenceId = typeof input?.occurrenceId === "string" ? input.occurrenceId : "";
    if (!occurrenceId) return prevState;
    const occurrence = resolveOccurrence(occurrences, occurrenceId);
    const occurrenceStatus = normalizeOccurrenceStatus(occurrence?.status);
    if (isTerminalOccurrenceStatus(occurrenceStatus)) return prevState;

    const currentIsSameOpen =
      current && isRuntimeSessionOpen(current) && typeof current.occurrenceId === "string" && current.occurrenceId === occurrenceId;

    const nextSession = currentIsSameOpen
      ? {
          ...current,
          status: toLegacyStatus(SESSION_RUNTIME_PHASE.IN_PROGRESS),
          runtimePhase: SESSION_RUNTIME_PHASE.IN_PROGRESS,
          dateKey:
            normalizeLocalDateKey(input?.dateKey || occurrence?.date || current?.dateKey || current?.date) ||
            current?.dateKey ||
            todayLocalKey(),
          objectiveId: input?.objectiveId ?? current?.objectiveId ?? null,
          habitIds: normalizeIdList(input?.habitIds || current?.habitIds || (occurrence?.goalId ? [occurrence.goalId] : [])),
        }
      : buildBaseSession({
          current,
          occurrenceId,
          dateKey: input?.dateKey || occurrence?.date || current?.dateKey,
          objectiveId: input?.objectiveId ?? current?.objectiveId ?? null,
          habitIds: input?.habitIds || (occurrence?.goalId ? [occurrence.goalId] : current?.habitIds || []),
          nowIso,
        });

    const nextOccurrences = applyOccurrenceRuntimeStatus(
      occurrences,
      goals,
      occurrenceId,
      OCCURRENCE_STATUS.IN_PROGRESS
    );
    const historyRecord = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey: nextSession.dateKey,
      state: "in_progress",
      nowIso,
      timerSeconds: 0,
    });
    const nextHistory = upsertSessionV2(prevHistory, historyRecord);
    return withNextState(prevState, {
      activeSession: nextSession,
      occurrences: nextOccurrences,
      sessionHistory: nextHistory,
      ui: prevUi,
    });
  }

  if (!current || !isAllowedTransition(phase, type)) return prevState;

  const occurrenceId =
    typeof input?.occurrenceId === "string" && input.occurrenceId ? input.occurrenceId : current.occurrenceId || "";
  if (!occurrenceId) return prevState;
  const occurrence = resolveOccurrence(occurrences, occurrenceId);
  const dateKey = normalizeLocalDateKey(
    input?.dateKey || occurrence?.date || current?.dateKey || current?.date || todayLocalKey()
  ) || todayLocalKey();
  let nextSession = current;
  let nextOccurrences = occurrences;
  let nextHistory = prevHistory;

  if (type === SESSION_RUNTIME_EVENT.PAUSE) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.PAUSED),
      runtimePhase: SESSION_RUNTIME_PHASE.PAUSED,
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: elapsedSec,
    };
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "in_progress",
      nowIso,
      timerSeconds: elapsedSec,
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  } else if (type === SESSION_RUNTIME_EVENT.RESUME) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.IN_PROGRESS),
      runtimePhase: SESSION_RUNTIME_PHASE.IN_PROGRESS,
      timerRunning: true,
      timerStartedAt: nowIso,
      timerAccumulatedSec: elapsedSec,
      startedAt: current.startedAt || nowIso,
    };
    nextOccurrences = applyOccurrenceRuntimeStatus(
      occurrences,
      goals,
      occurrenceId,
      OCCURRENCE_STATUS.IN_PROGRESS
    );
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "in_progress",
      nowIso,
      timerSeconds: elapsedSec,
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  } else if (type === SESSION_RUNTIME_EVENT.FINISH) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    const doneHabitIds = normalizeIdList(input?.doneHabitIds || current.doneHabitIds || []);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.DONE),
      runtimePhase: SESSION_RUNTIME_PHASE.DONE,
      doneHabitIds,
      durationSec: elapsedSec,
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: elapsedSec,
      finishedAt: nowIso,
    };
    nextOccurrences = applyOccurrenceRuntimeStatus(occurrences, goals, occurrenceId, OCCURRENCE_STATUS.DONE);
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "ended",
      endedReason: "done",
      nowIso,
      timerSeconds: elapsedSec,
      feedbackLevel: typeof input?.feedbackLevel === "string" ? input.feedbackLevel : "",
      feedbackText: typeof input?.feedbackText === "string" ? input.feedbackText : "",
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  } else if (type === SESSION_RUNTIME_EVENT.BLOCK) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.BLOCKED),
      runtimePhase: SESSION_RUNTIME_PHASE.BLOCKED,
      doneHabitIds: [],
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: elapsedSec,
      finishedAt: nowIso,
    };
    nextOccurrences = applyOccurrenceRuntimeStatus(occurrences, goals, occurrenceId, OCCURRENCE_STATUS.PLANNED);
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "ended",
      endedReason: "blocked",
      nowIso,
      timerSeconds: elapsedSec,
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  } else if (type === SESSION_RUNTIME_EVENT.REPORT) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.REPORTED),
      runtimePhase: SESSION_RUNTIME_PHASE.REPORTED,
      doneHabitIds: [],
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: elapsedSec,
      finishedAt: nowIso,
    };
    const occurrenceStatus = typeof input?.occurrenceStatus === "string" ? input.occurrenceStatus : "";
    nextOccurrences = occurrenceStatus
      ? applyOccurrenceRuntimeStatus(occurrences, goals, occurrenceId, occurrenceStatus)
      : occurrences;
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "ended",
      endedReason: "reported",
      nowIso,
      timerSeconds: elapsedSec,
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  } else if (type === SESSION_RUNTIME_EVENT.CANCEL) {
    const elapsedSec = clampDurationSec(input?.durationSec) ?? computeElapsedSec(current, nowMs);
    nextSession = {
      ...current,
      status: toLegacyStatus(SESSION_RUNTIME_PHASE.CANCELED),
      runtimePhase: SESSION_RUNTIME_PHASE.CANCELED,
      doneHabitIds: [],
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: elapsedSec,
      finishedAt: nowIso,
    };
    nextOccurrences = applyOccurrenceRuntimeStatus(occurrences, goals, occurrenceId, OCCURRENCE_STATUS.SKIPPED);
    const record = buildHistoryRecord({
      currentSession: nextSession,
      occurrence,
      occurrenceId,
      dateKey,
      state: "ended",
      endedReason: "canceled",
      nowIso,
      timerSeconds: elapsedSec,
    });
    nextHistory = upsertSessionV2(prevHistory, record);
  }

  return withNextState(prevState, {
    activeSession: nextSession,
    occurrences: nextOccurrences,
    sessionHistory: nextHistory,
    ui: prevUi,
  });
}

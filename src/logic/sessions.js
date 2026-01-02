import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";

const STATUSES = new Set(["done", "partial", "skipped"]);

function normalizeStatus(raw) {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  return STATUSES.has(v) ? v : "done";
}

function normalizeDuration(raw) {
  if (!Number.isFinite(raw)) return null;
  const value = Math.round(raw);
  return value >= 0 ? value : null;
}

export function normalizeSession(rawSession) {
  const s = rawSession && typeof rawSession === "object" ? { ...rawSession } : {};
  if (!s.id) s.id = uid();
  if (typeof s.habitId !== "string") s.habitId = "";
  if (typeof s.objectiveId !== "string") s.objectiveId = null;
  if (typeof s.date !== "string" || !s.date.trim()) s.date = todayKey();
  s.status = normalizeStatus(s.status);
  s.duration = normalizeDuration(s.duration);
  if (typeof s.note !== "string") s.note = "";
  if (typeof s.startedAt !== "string") s.startedAt = "";
  return s;
}

function findSessionIndex(sessions, habitId, dateKey, allowSkipped = false) {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (!s || s.habitId !== habitId || s.date !== dateKey) continue;
    if (!allowSkipped && s.status === "skipped") continue;
    return i;
  }
  return -1;
}

function resolveDuration(startedAt, overrideMinutes, fallbackMinutes) {
  if (Number.isFinite(overrideMinutes)) return normalizeDuration(overrideMinutes);
  if (startedAt) {
    const started = new Date(startedAt).getTime();
    const now = Date.now();
    const diff = now - started;
    if (Number.isFinite(diff) && diff > 0) return normalizeDuration(diff / 60000);
  }
  if (Number.isFinite(fallbackMinutes)) return normalizeDuration(fallbackMinutes);
  return null;
}

export function startSession(state, habitId, dateKey, objectiveId, fallbackMinutes) {
  if (!state || !habitId || !dateKey) return state;
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const existingIndex = findSessionIndex(sessions, habitId, dateKey, false);
  if (existingIndex >= 0) return state;

  const session = normalizeSession({
    habitId,
    objectiveId: typeof objectiveId === "string" ? objectiveId : null,
    date: dateKey,
    status: "partial",
    duration: normalizeDuration(fallbackMinutes),
    startedAt: new Date().toISOString(),
  });

  return { ...state, sessions: [...sessions, session] };
}

export function finishSession(state, habitId, dateKey, objectiveId, fallbackMinutes, durationOverride) {
  if (!state || !habitId || !dateKey) return state;
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const existingIndex = findSessionIndex(sessions, habitId, dateKey, false);

  if (existingIndex >= 0) {
    const current = sessions[existingIndex];
    const finished = {
      ...current,
      objectiveId: typeof objectiveId === "string" ? objectiveId : current.objectiveId || null,
      status: "done",
      duration: resolveDuration(current.startedAt, durationOverride, fallbackMinutes),
    };
    const nextSessions = sessions.slice();
    nextSessions[existingIndex] = normalizeSession(finished);
    return { ...state, sessions: nextSessions };
  }

  const session = normalizeSession({
    habitId,
    objectiveId: typeof objectiveId === "string" ? objectiveId : null,
    date: dateKey,
    status: "done",
    duration: resolveDuration("", durationOverride, fallbackMinutes),
  });

  return { ...state, sessions: [...sessions, session] };
}

export function skipSession(state, habitId, dateKey) {
  if (!state || !habitId || !dateKey) return state;
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const existingIndex = findSessionIndex(sessions, habitId, dateKey, false);
  if (existingIndex < 0) return state;

  const current = sessions[existingIndex];
  const skipped = normalizeSession({ ...current, status: "skipped" });
  const nextSessions = sessions.slice();
  nextSessions[existingIndex] = skipped;
  return { ...state, sessions: nextSessions };
}

export function getDoneSessionsForDate(sessions, dateKey) {
  if (!Array.isArray(sessions) || !dateKey) return [];
  return sessions.filter((s) => s && s.date === dateKey && s.status === "done");
}

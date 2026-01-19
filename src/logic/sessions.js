import { uid } from "../utils/helpers";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { setOccurrenceStatus } from "./occurrences";
import { resolveGoalType } from "../domain/goalType";
import { hasHabitChecked, setHabitChecked } from "./checks";
import { dedupeOccurrences, ensureWindowForGoal, resolveConflictNearest } from "./occurrencePlanner";

const STATUSES = new Set(["done", "partial", "skipped"]);

function normalizeStatus(raw) {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  return STATUSES.has(v) ? v : "done";
}

function normalizeDateKey(raw) {
  const v = normalizeLocalDateKey(raw);
  return v || todayLocalKey();
}

function normalizeDuration(raw) {
  if (!Number.isFinite(raw)) return null;
  const value = Math.round(raw);
  return value >= 0 ? value : null;
}

function normalizeDurationSec(raw) {
  if (!Number.isFinite(raw)) return null;
  const value = Math.round(raw);
  return value >= 0 ? value : null;
}

function normalizeIdList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => id.trim());
}

function sameIdList(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function normalizeSession(rawSession) {
  const s = rawSession && typeof rawSession === "object" ? { ...rawSession } : {};
  if (!s.id) s.id = uid();
  if (typeof s.habitId !== "string") s.habitId = s.habitId ? String(s.habitId) : "";
  if (typeof s.objectiveId !== "string") s.objectiveId = null;
  const dateKey = normalizeDateKey(s.dateKey || s.date);
  s.date = dateKey;
  s.dateKey = dateKey;
  s.status = normalizeStatus(s.status);
  s.duration = normalizeDuration(s.duration);
  if (typeof s.durationSec !== "number") {
    s.durationSec = s.duration != null ? normalizeDurationSec(s.duration * 60) : null;
  } else {
    s.durationSec = normalizeDurationSec(s.durationSec);
  }
  if (typeof s.note !== "string") s.note = "";
  if (typeof s.startedAt !== "string") s.startedAt = typeof s.startAt === "string" ? s.startAt : "";
  if (typeof s.finishedAt !== "string") s.finishedAt = "";
  s.startAt = s.startedAt;
  s.habitIds = normalizeIdList(s.habitIds);
  if (s.habitId && !s.habitIds.includes(s.habitId)) {
    s.habitIds = [...s.habitIds, s.habitId];
  }
  const doneBase = Array.isArray(s.doneHabits) ? s.doneHabits : s.doneHabitIds;
  const doneNormalized = normalizeIdList(doneBase);
  s.doneHabitIds = doneNormalized;
  s.doneHabits = doneNormalized;
  const timer = s.timer && typeof s.timer === "object" ? s.timer : null;
  if (typeof s.timerStartedAt !== "string")
    s.timerStartedAt = typeof timer?.startedAt === "string" ? timer.startedAt : "";
  if (!Number.isFinite(s.timerAccumulatedSec)) {
    const rawAccum = timer?.accumulatedSec;
    s.timerAccumulatedSec = Number.isFinite(rawAccum) ? normalizeDurationSec(rawAccum) : 0;
  } else {
    s.timerAccumulatedSec = normalizeDurationSec(s.timerAccumulatedSec);
  }
  if (typeof s.timerRunning !== "boolean") {
    const inferred = typeof timer?.isRunning === "boolean" ? timer.isRunning : false;
    s.timerRunning = inferred || (s.status === "partial" && Boolean(s.timerStartedAt));
  }
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

function getSessionTimestamp(session) {
  if (!session) return 0;
  const raw = session.finishedAt || session.startedAt || session.startAt || "";
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function getStatusPriority(status) {
  if (status === "partial") return 3;
  if (status === "done") return 2;
  if (status === "skipped") return 1;
  return 0;
}

function findSessionIndexByDate(sessions, dateKey, objectiveId, status) {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (!s || s.date !== dateKey) continue;
    if (objectiveId && s.objectiveId !== objectiveId) continue;
    if (status && s.status !== status) continue;
    return i;
  }
  return -1;
}

function applyDoneHabitsToChecks(state, dateKey, doneHabitIds) {
  let next = state;
  for (const id of doneHabitIds) {
    if (hasHabitChecked(next, dateKey, id)) continue;
    next = setHabitChecked(next, dateKey, id, true);
  }
  return next;
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isValidStart(value) {
  return parseTimeToMinutes(value) != null;
}

function roundToNearestQuarter(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.round(minutes / 15) * 15;
  const clamped = Math.max(0, Math.min(23 * 60 + 59, rounded));
  return minutesToTime(clamped);
}

function pickNearestTimeSlot(timeSlots = [], preferredStart = "") {
  const slots = Array.isArray(timeSlots) ? timeSlots.filter(Boolean) : [];
  if (!slots.length) return "";
  if (preferredStart && slots.includes(preferredStart)) return preferredStart;

  const prefMin = parseTimeToMinutes(preferredStart);
  const parsed = slots
    .map((t) => ({ t, m: parseTimeToMinutes(t) }))
    .filter((x) => x.m != null)
    .sort((a, b) => a.m - b.m);

  if (!parsed.length) return slots.slice().sort()[0] || "";
  if (prefMin == null) return parsed[0].t;

  let best = parsed[0];
  let bestDiff = Math.abs(best.m - prefMin);
  for (let i = 1; i < parsed.length; i += 1) {
    const diff = Math.abs(parsed[i].m - prefMin);
    if (diff < bestDiff) {
      best = parsed[i];
      bestDiff = diff;
    }
  }
  return best.t;
}

function pickClosestOccurrenceStart(list, preferredMin, options = {}) {
  if (!Array.isArray(list) || !Number.isFinite(preferredMin)) return "";
  const preferPlanned = options.preferPlanned !== false;
  const planned = list.filter((o) => o?.status === "planned");
  const candidates = preferPlanned && planned.length ? planned : list;
  let best = "";
  let bestDiff = Infinity;
  let bestMin = null;
  for (const occ of candidates) {
    const start = typeof occ?.start === "string" ? occ.start : "";
    const startMin = parseTimeToMinutes(start);
    if (startMin == null) continue;
    const diff = Math.abs(startMin - preferredMin);
    if (diff < bestDiff || (diff === bestDiff && (bestMin == null || startMin > bestMin))) {
      best = start;
      bestDiff = diff;
      bestMin = startMin;
    }
  }
  return best;
}

function pickOccurrenceStart(occurrences, goalId, dateKey, preferredStart, timeSlots = []) {
  const matches = occurrences.filter((o) => o && o.goalId === goalId && o.date === dateKey);
  if (matches.length) {
    if (preferredStart && matches.some((o) => o.start === preferredStart)) return preferredStart;
    const sorted = matches
      .map((o) => o.start)
      .filter(Boolean)
      .sort();
    return sorted[0] || preferredStart || "";
  }
  // No existing occurrences that day: choose the nearest available slot from schedule
  return pickNearestTimeSlot(timeSlots, preferredStart) || preferredStart || "";
}

function syncOccurrencesForDoneHabits(state, dateKey, doneHabitIds) {
  if (!state || !dateKey || !Array.isArray(doneHabitIds) || doneHabitIds.length === 0) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  let nextState = state;
  const key = normalizeDateKey(dateKey);
  if (!key) return state;

  for (const habitId of doneHabitIds) {
    const goal = goals.find((g) => g && g.id === habitId);
    if (!goal || resolveGoalType(goal) !== "PROCESS") continue;
    nextState = ensureWindowForGoal(nextState, habitId, key, 1);
    const occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
    const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
    const timeSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots.filter(Boolean) : [];
    const preferredStart = timeSlots[0] || "";
    const start = pickOccurrenceStart(occurrences, habitId, key, preferredStart, timeSlots);
    if (!start) continue;
    const updated = setOccurrenceStatus(habitId, key, start, "done", { occurrences });
    nextState = { ...nextState, occurrences: updated };
  }

  return nextState;
}

function getSessionHabitIds(session) {
  const ids = normalizeIdList(session?.habitIds);
  if (session?.habitId && !ids.includes(session.habitId)) ids.push(session.habitId);
  return ids;
}

function syncOccurrencesForSkippedHabits(state, dateKey, habitIds) {
  if (!state || !dateKey || !Array.isArray(habitIds) || habitIds.length === 0) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  let nextState = state;
  const key = normalizeDateKey(dateKey);
  if (!key) return state;

  for (const habitId of habitIds) {
    const goal = goals.find((g) => g && g.id === habitId);
    if (!goal || resolveGoalType(goal) !== "PROCESS") continue;
    nextState = ensureWindowForGoal(nextState, habitId, key, 1);
    const occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
    const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
    const timeSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots.filter(Boolean) : [];
    const preferredStart = timeSlots[0] || "";
    const start = pickOccurrenceStart(occurrences, habitId, key, preferredStart, timeSlots);
    if (!start) continue;
    const updated = setOccurrenceStatus(habitId, key, start, "skipped", { occurrences });
    nextState = { ...nextState, occurrences: updated };
  }

  return nextState;
}

function findSessionIndexForHabit(sessions, dateKey, habitId) {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (!s || s.date !== dateKey) continue;
    if (s.status !== "partial") continue;
    const ids = Array.isArray(s.habitIds) ? s.habitIds : [];
    if (s.habitId === habitId || ids.includes(habitId)) return i;
  }
  return -1;
}

function extractStartAtTime(startAt) {
  if (typeof startAt !== "string") return "";
  const match = startAt.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function resolvePreferredStart(preferredStart) {
  if (isValidStart(preferredStart)) return preferredStart;
  return roundToNearestQuarter(new Date());
}

function resolveSkippedStart(goal, dateKey, preferredStart, occurrences) {
  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const timeSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots.filter(Boolean) : [];
  const startAtTime = extractStartAtTime(goal.startAt);
  const hasPlanning =
    Boolean(normalizeLocalDateKey(goal.oneOffDate)) || timeSlots.length > 0 || Boolean(startAtTime);

  if (timeSlots.length) {
    const preferred = resolvePreferredStart(preferredStart);
    const durationMinutes = Number.isFinite(schedule?.durationMinutes)
      ? schedule.durationMinutes
      : Number.isFinite(goal.sessionMinutes)
        ? goal.sessionMinutes
        : 30;
    const resolved = resolveConflictNearest(occurrences, dateKey, preferred, durationMinutes, timeSlots);
    return { start: resolved.start, conflict: resolved.conflict && resolved.start !== "00:00" };
  }

  if (startAtTime) {
    return { start: isValidStart(startAtTime) ? startAtTime : "09:00", conflict: false };
  }

  if (normalizeLocalDateKey(goal.oneOffDate)) {
    return { start: "09:00", conflict: false };
  }

  return { start: hasPlanning ? "09:00" : "00:00", conflict: false };
}

export function getSessionsForDate(state, dateKey) {
  if (!state) return [];
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const key = normalizeDateKey(dateKey);
  return list.filter((s) => s && (s.dateKey || s.date) === key);
}

export function getSessionByDate(state, dateKey, objectiveId) {
  const key = normalizeDateKey(dateKey);
  const list = getSessionsForDate(state, key).filter(
    (s) => !objectiveId || s.objectiveId === objectiveId
  );
  if (!list.length) return null;
  return list.reduce((best, cur) => {
    if (!best) return cur;
    const pCur = getStatusPriority(cur.status);
    const pBest = getStatusPriority(best.status);
    if (pCur !== pBest) return pCur > pBest ? cur : best;
    return getSessionTimestamp(cur) >= getSessionTimestamp(best) ? cur : best;
  }, null);
}

export function startSessionForDate(state, dateKey, payload = {}) {
  if (!state) return state;
  const key = normalizeDateKey(dateKey);
  const objectiveId = typeof payload.objectiveId === "string" ? payload.objectiveId : null;
  const habitIds = normalizeIdList(payload.habitIds);
  if (!objectiveId || habitIds.length === 0) return state;
  const existing = getSessionByDate(state, key, objectiveId);
  if (existing) {
    const current = normalizeSession(existing);
    const canUpdateHabits =
      current.status === "partial" &&
      !current.timerRunning &&
      !current.startedAt &&
      current.timerAccumulatedSec === 0 &&
      current.doneHabitIds.length === 0;
    if (!canUpdateHabits || sameIdList(current.habitIds, habitIds)) return state;
    const list = Array.isArray(state.sessions) ? state.sessions : [];
    const idx = findSessionIndexByDate(list, key, objectiveId, "partial");
    if (idx < 0) return state;
    const nextSession = normalizeSession({ ...current, habitIds, doneHabitIds: [] });
    const nextSessions = list.slice();
    nextSessions[idx] = nextSession;
    return { ...state, sessions: nextSessions };
  }
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const session = normalizeSession({
    id: uid(),
    date: key,
    objectiveId,
    habitIds,
    doneHabitIds: [],
    status: "partial",
    startedAt: "",
    timerStartedAt: "",
    timerAccumulatedSec: 0,
    timerRunning: false,
  });
  return { ...state, sessions: [...list, session] };
}

export function clearSessionForDate(state, dateKey, objectiveId) {
  if (!state) return state;
  const key = normalizeDateKey(dateKey);
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const id = typeof objectiveId === "string" ? objectiveId : null;
  const idx = findSessionIndexByDate(list, key, id, "partial");
  if (idx < 0) return state;
  const current = normalizeSession(list[idx]);
  const canClear =
    !current.timerRunning &&
    !current.startedAt &&
    current.timerAccumulatedSec === 0 &&
    current.doneHabitIds.length === 0;
  if (!canClear) return state;
  const nextSessions = list.slice();
  nextSessions.splice(idx, 1);
  return { ...state, sessions: nextSessions };
}

export function updateSessionTimerForDate(state, dateKey, payload = {}) {
  if (!state) return state;
  const key = normalizeDateKey(dateKey);
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const objectiveId = typeof payload.objectiveId === "string" ? payload.objectiveId : null;
  const idx = findSessionIndexByDate(list, key, objectiveId, "partial");
  if (idx < 0) return state;
  const current = normalizeSession(list[idx]);
  const timerStartedAt =
    typeof payload.timerStartedAt === "string" ? payload.timerStartedAt : current.timerStartedAt;
  const timerAccumulatedSec = Number.isFinite(payload.timerAccumulatedSec)
    ? normalizeDurationSec(payload.timerAccumulatedSec)
    : current.timerAccumulatedSec;
  const timerRunning =
    typeof payload.timerRunning === "boolean" ? payload.timerRunning : current.timerRunning;
  const next = normalizeSession({
    ...current,
    timerStartedAt,
    timerAccumulatedSec,
    timerRunning,
    startedAt: timerStartedAt || current.startedAt || "",
  });
  const nextSessions = list.slice();
  nextSessions[idx] = next;
  return { ...state, sessions: nextSessions };
}

export function toggleSessionHabit(state, dateKey, habitId, nextValue, objectiveId) {
  if (!state || !habitId) return state;
  const key = normalizeDateKey(dateKey);
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const idx = findSessionIndexByDate(list, key, objectiveId, "partial");
  if (idx < 0) return state;
  const current = normalizeSession(list[idx]);
  const set = new Set(current.doneHabitIds);
  if (nextValue) set.add(habitId);
  else set.delete(habitId);
  const nextSession = normalizeSession({ ...current, doneHabitIds: Array.from(set) });
  const nextSessions = list.slice();
  nextSessions[idx] = nextSession;
  return { ...state, sessions: nextSessions };
}

export function finishSessionForDate(state, dateKey, payload = {}) {
  if (!state) return state;
  const key = normalizeDateKey(dateKey);
  const list = Array.isArray(state.sessions) ? state.sessions : [];
  const objectiveId = typeof payload.objectiveId === "string" ? payload.objectiveId : null;
  const idx = findSessionIndexByDate(list, key, objectiveId, "partial");
  if (idx < 0) return state;
  const current = normalizeSession(list[idx]);
  const doneHabitIds = normalizeIdList(payload.doneHabitIds || current.doneHabitIds);
  const durationSec = normalizeDurationSec(payload.durationSec);
  const duration = durationSec != null ? normalizeDuration(durationSec / 60) : current.duration;
  const finished = normalizeSession({
    ...current,
    status: "done",
    finishedAt: new Date().toISOString(),
    durationSec,
    duration,
    doneHabitIds,
    timerRunning: false,
    timerStartedAt: "",
    timerAccumulatedSec: durationSec != null ? durationSec : current.timerAccumulatedSec,
  });
  const nextSessions = list.slice();
  nextSessions[idx] = finished;
  const nextState = { ...state, sessions: nextSessions };
  const withChecks = applyDoneHabitsToChecks(nextState, key, doneHabitIds);
  return syncOccurrencesForDoneHabits(withChecks, key, doneHabitIds);
}

export function skipSessionForDate(state, goalId, dateKey, preferredStart = "") {
  if (!state) return state;
  const key = normalizeDateKey(dateKey);
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g && g.id === goalId) || null;
  if (!goal || resolveGoalType(goal) !== "PROCESS") return state;

  let nextState = state;
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const sessionIdx = findSessionIndexForHabit(sessions, key, goalId);
  if (sessionIdx >= 0) {
    const current = normalizeSession(sessions[sessionIdx]);
    const skipped = normalizeSession({
      ...current,
      status: "skipped",
      finishedAt: new Date().toISOString(),
      durationSec: 0,
      duration: 0,
      timerRunning: false,
      timerStartedAt: "",
      timerAccumulatedSec: current.timerAccumulatedSec || 0,
    });
    const nextSessions = sessions.slice();
    nextSessions[sessionIdx] = skipped;
    nextState = { ...nextState, sessions: nextSessions };
  }

  const preferred = resolvePreferredStart(preferredStart);
  const preferredMin = parseTimeToMinutes(preferred);
  let occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
  const candidates = occurrences.filter((o) => o && o.goalId === goalId && o.date === key);
  const chosenStart = pickClosestOccurrenceStart(candidates, preferredMin, { preferPlanned: true });
  if (chosenStart) {
    const updated = setOccurrenceStatus(goalId, key, chosenStart, "skipped", { occurrences });
    return { ...nextState, occurrences: updated };
  }

  nextState = ensureWindowForGoal(nextState, goalId, key, 1);
  occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
  const rechecked = occurrences.filter((o) => o && o.goalId === goalId && o.date === key);
  const retryStart = pickClosestOccurrenceStart(rechecked, preferredMin, { preferPlanned: true });
  if (retryStart) {
    const updated = setOccurrenceStatus(goalId, key, retryStart, "skipped", { occurrences });
    return { ...nextState, occurrences: updated };
  }

  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const durationMinutes = Number.isFinite(schedule?.durationMinutes)
    ? schedule.durationMinutes
    : Number.isFinite(goal.sessionMinutes)
      ? goal.sessionMinutes
      : 30;
  const resolved = resolveSkippedStart(goal, key, preferred, occurrences);
  const start = isValidStart(resolved.start) ? resolved.start : "00:00";
  const created = {
    id: uid(),
    goalId,
    date: key,
    start,
    durationMinutes,
    status: "skipped",
  };
  if (resolved.conflict && start !== "00:00") created.conflict = true;
  const nextOccurrences = dedupeOccurrences([...occurrences, created]);
  return { ...nextState, occurrences: nextOccurrences };
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
      finishedAt: new Date().toISOString(),
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
    finishedAt: new Date().toISOString(),
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

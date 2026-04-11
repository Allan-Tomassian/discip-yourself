import { compareOccurrencesByUserAiPreference } from "../../../../src/domain/userAiProfile.js";

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const AI_CONTEXT_ACTIVE_SESSION_KEYS = Object.freeze([
  "id",
  "occurrenceId",
  "objectiveId",
  "habitIds",
  "dateKey",
  "date",
  "runtimePhase",
  "status",
  "timerRunning",
  "timerStartedAt",
  "timerAccumulatedSec",
  "isOpen",
]);

export function normalizeDateKey(value, fallback = "") {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateKey(value);
  }
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return toDateKey(parsed);
  return fallback;
}

export function resolveCategory(data, categoryId) {
  const categories = safeArray(data?.categories);
  if (categoryId) {
    const exact = categories.find((category) => category?.id === categoryId);
    if (exact) return exact;
  }
  return categories[0] || null;
}

export function resolveGoalMap(data) {
  return new Map(safeArray(data?.goals).filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
}

export function resolveCategoryMap(data) {
  return new Map(safeArray(data?.categories).filter((category) => category?.id).map((category) => [category.id, category]));
}

export function resolveOccurrencesForDate(data, dateKey, categoryId = null) {
  const goalsById = resolveGoalMap(data);
  return safeArray(data?.occurrences).filter((occurrence) => {
    if (!occurrence || normalizeDateKey(occurrence.date) !== dateKey) return false;
    if (!categoryId) return true;
    const goal = goalsById.get(occurrence.goalId);
    return goal?.categoryId === categoryId;
  });
}

export function resolvePlannedActionsForDate(data, dateKey, categoryId = null) {
  return resolveOccurrencesForDate(data, dateKey, categoryId).filter((occurrence) => occurrence?.status === "planned");
}

export function sanitizeActiveSessionForAiContext(session) {
  const safe = safeObject(session);
  if (!safe || !safe.id) return null;
  const next = {};
  AI_CONTEXT_ACTIVE_SESSION_KEYS.forEach((key) => {
    if (key in safe) next[key] = safe[key];
  });
  return next;
}

export function sanitizeUserDataForAiContext(data) {
  const safe = safeObject(data);
  const ui = safeObject(safe.ui);
  if (!ui || !("activeSession" in ui)) return safe;
  return {
    ...safe,
    ui: {
      ...ui,
      activeSession: sanitizeActiveSessionForAiContext(ui.activeSession),
    },
  };
}

export function normalizeSession(session) {
  const safe = safeObject(sanitizeActiveSessionForAiContext(session));
  if (!safe || !safe.id) return null;
  const runtimePhase = typeof safe.runtimePhase === "string" ? safe.runtimePhase : "";
  const status = typeof safe.status === "string" ? safe.status : "";
  const isOpen =
    runtimePhase === "in_progress" ||
    runtimePhase === "paused" ||
    (status === "partial" && runtimePhase !== "done" && runtimePhase !== "canceled");
  return {
    id: safe.id,
    occurrenceId: typeof safe.occurrenceId === "string" ? safe.occurrenceId : null,
    objectiveId: typeof safe.objectiveId === "string" ? safe.objectiveId : null,
    habitIds: safeArray(safe.habitIds).filter(Boolean),
    dateKey: normalizeDateKey(safe.dateKey || safe.date),
    runtimePhase,
    status,
    timerRunning: safe.timerRunning === true,
    timerAccumulatedSec: Number.isFinite(safe.timerAccumulatedSec) ? safe.timerAccumulatedSec : 0,
    isOpen,
  };
}

export function resolveActiveSessionForDate(data, dateKey) {
  const session = normalizeSession(data?.ui?.activeSession);
  if (!session?.isOpen) return null;
  if (session.dateKey && session.dateKey !== dateKey) return null;
  return session;
}

export function resolveSessionSplitForDate(data, dateKey) {
  const session = normalizeSession(data?.ui?.activeSession);
  if (!session?.isOpen) {
    return {
      activeSessionForActiveDate: null,
      openSessionOutsideActiveDate: null,
      futureSessions: [],
    };
  }

  if (session.dateKey === dateKey) {
    return {
      activeSessionForActiveDate: session,
      openSessionOutsideActiveDate: null,
      futureSessions: [],
    };
  }

  const openSessionOutsideActiveDate = session;
  return {
    activeSessionForActiveDate: null,
    openSessionOutsideActiveDate,
    futureSessions: session.dateKey && session.dateKey > dateKey ? [session] : [],
  };
}

function resolveStartMinutes(occurrence) {
  const raw =
    typeof occurrence?.start === "string" && occurrence.start
      ? occurrence.start
      : typeof occurrence?.slotKey === "string"
        ? occurrence.slotKey
        : "";
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isFixedOccurrence(occurrence) {
  if (!occurrence || typeof occurrence !== "object") return false;
  if (occurrence.noTime === true) return false;
  if (occurrence.timeType === "window") return false;
  return Number.isFinite(resolveStartMinutes(occurrence));
}

function resolvePriorityRank(occurrence) {
  const raw =
    typeof occurrence?.priority === "string"
      ? occurrence.priority
      : typeof occurrence?.priorityLevel === "string"
        ? occurrence.priorityLevel
        : "";
  const key = raw.toLowerCase();
  if (key === "prioritaire" || key === "primary") return 3;
  if (key === "secondaire" || key === "secondary") return 2;
  if (key === "bonus") return 1;
  return 0;
}

function stableKey(occurrence) {
  const goalId = typeof occurrence?.goalId === "string" ? occurrence.goalId : "";
  const id = typeof occurrence?.id === "string" ? occurrence.id : "";
  return `${goalId}:${id}`;
}

function sortByPriorityThenStable(left, right, preferredTimeBlocks = []) {
  const leftRank = resolvePriorityRank(left);
  const rightRank = resolvePriorityRank(right);
  if (leftRank !== rightRank) return rightRank - leftRank;
  if (Array.isArray(preferredTimeBlocks) && preferredTimeBlocks.length > 0) {
    const preferredComparison = compareOccurrencesByUserAiPreference(left, right, preferredTimeBlocks);
    if (preferredComparison !== 0) return preferredComparison;
  }
  return stableKey(left).localeCompare(stableKey(right));
}

export function resolveFocusOccurrenceSelectionForDate({
  dateKey,
  now = new Date(),
  occurrences = [],
  preferredTimeBlocks = [],
}) {
  const normalizedDateKey = normalizeDateKey(dateKey);
  if (!normalizedDateKey) {
    return {
      occurrence: null,
      reason: null,
    };
  }
  const list = safeArray(occurrences).filter(
    (occurrence) => occurrence && occurrence.status === "planned" && normalizeDateKey(occurrence.date) === normalizedDateKey
  );
  if (!list.length) {
    return {
      occurrence: null,
      reason: null,
    };
  }

  const todayKey = normalizeDateKey(now);
  const nowMinutes =
    normalizedDateKey === todayKey && now instanceof Date ? now.getHours() * 60 + now.getMinutes() : -1;

  const fixedFuture = list
    .filter((occurrence) => isFixedOccurrence(occurrence))
    .map((occurrence) => ({ occurrence, startMinutes: resolveStartMinutes(occurrence) }))
    .filter((item) => Number.isFinite(item.startMinutes) && item.startMinutes >= nowMinutes)
    .sort(
      (left, right) =>
        left.startMinutes - right.startMinutes ||
        sortByPriorityThenStable(left.occurrence, right.occurrence, preferredTimeBlocks)
    );

  if (fixedFuture.length) {
    return {
      occurrence: fixedFuture[0].occurrence,
      reason: "upcoming_fixed",
    };
  }

  const fixedAll = list
    .filter((occurrence) => isFixedOccurrence(occurrence))
    .map((occurrence) => ({ occurrence, startMinutes: resolveStartMinutes(occurrence) }))
    .filter((item) => Number.isFinite(item.startMinutes))
    .sort(
      (left, right) =>
        left.startMinutes - right.startMinutes ||
        sortByPriorityThenStable(left.occurrence, right.occurrence, preferredTimeBlocks)
    );

  if (fixedAll.length) {
    return {
      occurrence: fixedAll[0].occurrence,
      reason: "earliest_fixed",
    };
  }

  const nonFixed = list
    .filter((occurrence) => !isFixedOccurrence(occurrence))
    .slice()
    .sort((left, right) => sortByPriorityThenStable(left, right, preferredTimeBlocks));
  return {
    occurrence: nonFixed[0] || null,
    reason: nonFixed.length ? "highest_priority_flexible" : null,
  };
}

export function resolveFocusOccurrenceForDate({
  dateKey,
  now = new Date(),
  occurrences = [],
  preferredTimeBlocks = [],
}) {
  return resolveFocusOccurrenceSelectionForDate({ dateKey, now, occurrences, preferredTimeBlocks }).occurrence;
}

export function buildWindowStats(data, dateKey, days) {
  const target = new Date(`${dateKey}T12:00:00`);
  const from = new Date(target);
  from.setDate(from.getDate() - (days - 1));
  const fromKey = normalizeDateKey(from);
  const occurrences = safeArray(data?.occurrences).filter((occurrence) => {
    const occurrenceDate = normalizeDateKey(occurrence?.date);
    return occurrenceDate && occurrenceDate >= fromKey && occurrenceDate <= dateKey;
  });
  const microChecks = safeObject(data?.microChecks);

  let expected = 0;
  let done = 0;
  let missed = 0;
  let planned = 0;

  for (const occurrence of occurrences) {
    const status = String(occurrence?.status || "");
    if (status !== "skipped" && status !== "canceled") expected += 1;
    if (status === "done") done += 1;
    if (status === "missed") missed += 1;
    if (status === "planned" || status === "in_progress") planned += 1;
  }

  let microDone = 0;
  for (const [microDateKey, bucket] of Object.entries(microChecks)) {
    const normalized = normalizeDateKey(microDateKey);
    if (!normalized || normalized < fromKey || normalized > dateKey) continue;
    microDone += Math.max(0, Math.min(3, Object.keys(safeObject(bucket)).length));
  }
  const weightedMicro = microDone * 0.25;
  const disciplineExpected = expected + weightedMicro;
  const disciplineDone = done + weightedMicro;
  const rate = disciplineExpected > 0 ? disciplineDone / disciplineExpected : 0;

  return {
    occurrences: {
      expected,
      done,
      missed,
      planned,
      remaining: Math.max(0, expected - done),
    },
    discipline: {
      expected: disciplineExpected,
      done: disciplineDone,
      rate,
      score: Math.round(rate * 100),
    },
  };
}

export function buildCategoryStatus(data, categoryId, dateKey) {
  if (!categoryId) return "EMPTY";
  const goals = safeArray(data?.goals).filter((goal) => goal?.categoryId === categoryId);
  const processGoals = goals.filter((goal) => goal?.type === "PROCESS" || goal?.planType === "ACTION" || goal?.planType === "ONE_OFF");
  if (!goals.length || !processGoals.length) return "EMPTY";
  const processIds = new Set(processGoals.map((goal) => goal.id));
  const occurrences = safeArray(data?.occurrences).filter(
    (occurrence) => processIds.has(occurrence?.goalId) && normalizeDateKey(occurrence?.date) === dateKey
  );
  if (!occurrences.length) return "ACTIVE";
  const hasRemaining = occurrences.some((occurrence) => occurrence?.status === "planned" || occurrence?.status === "in_progress");
  return hasRemaining ? "ACTIVE" : "DONE";
}

export function sortOccurrencesForExecution(occurrences = []) {
  const list = [...safeArray(occurrences)];
  return list.sort((left, right) => {
    const lStatus = String(left?.status || "");
    const rStatus = String(right?.status || "");
    if (lStatus !== rStatus) {
      if (lStatus === "in_progress") return -1;
      if (rStatus === "in_progress") return 1;
    }
    const lStart = typeof left?.start === "string" ? left.start : "99:99";
    const rStart = typeof right?.start === "string" ? right.start : "99:99";
    return lStart.localeCompare(rStart);
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

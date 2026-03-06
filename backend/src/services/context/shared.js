export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

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

export function resolveOccurrencesForDate(data, dateKey, categoryId = null) {
  const goalsById = resolveGoalMap(data);
  return safeArray(data?.occurrences).filter((occurrence) => {
    if (!occurrence || normalizeDateKey(occurrence.date) !== dateKey) return false;
    if (!categoryId) return true;
    const goal = goalsById.get(occurrence.goalId);
    return goal?.categoryId === categoryId;
  });
}

export function normalizeSession(session) {
  const safe = safeObject(session);
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

// src/logic/goals.js
import { todayKey } from "../utils/dates";
import { normalizeGoal, normalizeResetPolicy } from "./state";
import { resolveGoalType, isOutcome, isProcess } from "../domain/goalType";

const ALLOWED = new Set(["queued", "active", "done", "invalid"]);
const PLAN_TYPES = new Set(["ACTION", "ONE_OFF", "STATE"]);

// Future flag (do not change behavior elsewhere yet)
export const allowGlobalSingleActive = false;

function formatLocalDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function parseStartAt(value) {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  const ts = d.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function normalizeStatus(s) {
  const x = (s || "queued").toString().toLowerCase();
  return ALLOWED.has(x) ? x : "queued";
}

function getGoalSortKey(goal) {
  const key = goal?.activeSince || goal?.createdAt || "";
  return typeof key === "string" ? key : "";
}

function normalizePlanType(goal) {
  const rawPlan = typeof goal?.planType === "string" ? goal.planType.toUpperCase() : "";
  if (PLAN_TYPES.has(rawPlan)) return rawPlan;
  const rawType = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (PLAN_TYPES.has(rawType)) return rawType;
  if (goal?.oneOffDate || goal?.freqUnit === "ONCE") return "ONE_OFF";
  if (goal?.freqUnit || goal?.freqCount || goal?.cadence) return "ACTION";
  return "STATE";
}

function normalizeGoalType(goal, planType) {
  return resolveGoalType({ ...(goal || {}), planType });
}

export function sanitizeOutcome(goal) {
  if (!goal || typeof goal !== "object") return goal;
  const next = { ...goal };

  // OUTCOME = état/objectif mesurable, pas une action planifiée.
  next.planType = "STATE";

  // Never linked as a child.
  next.parentId = null;
  next.primaryGoalId = null;
  next.weight = null;
  next.linkWeight = null;

  // Remove habit/action scheduling fields.
  next.cadence = undefined;
  next.target = undefined;
  next.freqUnit = undefined;
  next.freqCount = undefined;
  next.oneOffDate = undefined;
  next.sessionMinutes = null;

  // OUTCOME does not need a start/end time in the planner.
  next.startAt = null;
  next.endAt = null;
  next.schedule = undefined;

  return next;
}

export function sanitizeProcess(goal) {
  if (!goal || typeof goal !== "object") return goal;
  const next = { ...goal };

  // PROCESS = action/habit (ACTION) or one-shot action (ONE_OFF)
  if (next.planType !== "ACTION" && next.planType !== "ONE_OFF") next.planType = "ACTION";

  // No metric/deadline/notes on PROCESS to avoid hybrids.
  next.metric = null;
  next.deadline = "";
  next.notes = undefined;
  next.measureType = null;
  next.targetValue = null;
  next.currentValue = null;

  // Keep schedule coherent.
  if (next.planType === "ACTION") {
    next.oneOffDate = undefined;
  }
  if (next.planType === "ONE_OFF") {
    // One-off actions are dated via oneOffDate, not via recurring frequency.
    next.cadence = undefined;
    next.target = undefined;
    next.freqUnit = undefined;
    next.freqCount = undefined;
    next.schedule = undefined;
  }

  return next;
}

function normalizeLegacyKind(goalType) {
  return goalType === "OUTCOME" ? "OUTCOME" : "ACTION";
}

function normalizeStartAt(goal, nowLocal, goalType) {
  const raw = typeof goal?.startAt === "string" ? goal.startAt.trim() : "";
  if (raw) return raw;
  const legacy = typeof goal?.startDate === "string" ? goal.startDate.trim() : "";
  if (legacy) return `${legacy}T09:00`;
  if (goalType === "OUTCOME") return null;
  return nowLocal;
}

function normalizeOneOffDate(goal) {
  const raw = typeof goal?.oneOffDate === "string" ? goal.oneOffDate.trim() : "";
  if (raw) return raw;
  const fallback = typeof goal?.deadline === "string" ? goal.deadline.trim() : "";
  return fallback;
}

function normalizeParentId(goal) {
  const raw = typeof goal?.parentId === "string" ? goal.parentId.trim() : "";
  if (raw) return raw;
  const legacy = typeof goal?.primaryGoalId === "string" ? goal.primaryGoalId.trim() : "";
  return legacy || null;
}

function normalizeWeight(goal, parentId) {
  const raw =
    typeof goal?.weight === "string"
      ? Number(goal.weight)
      : Number.isFinite(goal?.weight)
        ? goal.weight
        : typeof goal?.linkWeight === "string"
          ? Number(goal.linkWeight)
          : goal?.linkWeight;
  if (!Number.isFinite(raw)) return parentId ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function computeEndAt(startAt, sessionMinutes) {
  if (!startAt || !sessionMinutes) return null;
  const startMs = parseStartAt(startAt);
  if (!startMs) return null;
  const endMs = startMs + sessionMinutes * 60 * 1000;
  return formatLocalDateTime(new Date(endMs));
}

function resolveGoalEndAt(goal) {
  const raw = typeof goal?.endAt === "string" ? goal.endAt.trim() : "";
  if (raw) return raw;
  if (!goal?.sessionMinutes) return null;
  return computeEndAt(goal.startAt, goal.sessionMinutes);
}

function deriveFrequencyFromLegacy(goal) {
  const rawTarget = typeof goal?.target === "number" ? goal.target : 1;
  const target = Math.max(1, Math.floor(rawTarget));
  if (goal?.cadence === "DAILY") return { freqUnit: "DAY", freqCount: target };
  if (goal?.cadence === "WEEKLY") return { freqUnit: "WEEK", freqCount: target };
  if (goal?.cadence === "YEARLY") return { freqUnit: "YEAR", freqCount: target };
  return { freqUnit: "WEEK", freqCount: target };
}

function normalizeFrequency(goal) {
  const next = { freqUnit: goal?.freqUnit, freqCount: goal?.freqCount };

  if (!next.freqUnit || next.freqUnit === "ONCE") {
    const derived = deriveFrequencyFromLegacy(goal);
    next.freqUnit = derived.freqUnit;
    next.freqCount = derived.freqCount;
  }

  if (next.freqUnit === "ONCE") {
    next.freqCount = 1;
  } else {
    const raw = typeof next.freqCount === "number" ? next.freqCount : goal?.target;
    const count = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
    next.freqCount = count;
  }

  return next;
}

function normalizeSessionMinutes(goal) {
  const raw = typeof goal?.sessionMinutes === "string" ? Number(goal.sessionMinutes) : goal?.sessionMinutes;
  if (!Number.isFinite(raw)) return undefined;
  const value = Math.floor(raw);
  if (value < 5) return 5;
  if (value > 600) return 600;
  return value;
}

function normalizeMetric(goalType, metric) {
  if (goalType !== "OUTCOME") return null;
  if (!metric || typeof metric !== "object") return null;
  const unit = typeof metric.unit === "string" ? metric.unit.trim() : "";
  const targetRaw = typeof metric.targetValue === "string" ? Number(metric.targetValue) : metric.targetValue;
  const currentRaw = typeof metric.currentValue === "string" ? Number(metric.currentValue) : metric.currentValue;
  const targetValue = Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null;
  const currentValue = Number.isFinite(currentRaw) ? currentRaw : 0;
  return { unit, targetValue, currentValue };
}

function pickPreferredActiveId(actives, preferredId) {
  if (!actives.length) return null;
  if (preferredId && actives.some((g) => g?.id === preferredId)) return preferredId;
  let keep = actives[0];
  let bestKey = getGoalSortKey(keep);
  for (const g of actives.slice(1)) {
    const key = getGoalSortKey(g);
    if (key && (!bestKey || key > bestKey)) {
      keep = g;
      bestKey = key;
    }
  }
  return keep?.id || null;
}

function getGoalAgeKey(goal) {
  const key = goal?.activeSince || goal?.createdAt || goal?.startAt || "";
  return typeof key === "string" ? key : "";
}

function pickOldestActiveId(actives) {
  if (!actives.length) return null;
  let picked = actives[0];
  let bestKey = getGoalAgeKey(picked);
  for (const g of actives.slice(1)) {
    const key = getGoalAgeKey(g);
    if (key && (!bestKey || key < bestKey)) {
      picked = g;
      bestKey = key;
      continue;
    }
    if (!bestKey && !key) {
      const order = typeof g.order === "number" ? g.order : Number.POSITIVE_INFINITY;
      const bestOrder = typeof picked.order === "number" ? picked.order : Number.POSITIVE_INFINITY;
      if (order < bestOrder) picked = g;
    }
  }
  return picked?.id || null;
}

export function normalizeGoalsState(state) {
  if (!state || typeof state !== "object") return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const nowLocal = formatLocalDateTime(new Date());

  const normalizedGoals = goals.map((g) => {
    if (!g || typeof g !== "object") return g;
    const next = { ...g, status: normalizeStatus(g.status) };
    const planType = normalizePlanType(next);
    const goalType = normalizeGoalType(next, planType);
    const kind = normalizeLegacyKind(goalType);
    const parentId = normalizeParentId(next);
    const weight = normalizeWeight(next, parentId);
    const startAt = normalizeStartAt(next, nowLocal, goalType);
    const metric = normalizeMetric(goalType, next.metric);
    const sessionMinutesRaw = normalizeSessionMinutes(next);
    const sessionMinutes = goalType === "OUTCOME" ? null : sessionMinutesRaw ?? null;

    if (planType === "ONE_OFF") {
      const base = {
        ...next,
        type: goalType,
        planType,
        kind,
        startAt,
        endAt: computeEndAt(startAt, sessionMinutes),
        startDate: undefined,
        oneOffDate: normalizeOneOffDate(next),
        freqUnit: undefined,
        freqCount: undefined,
        sessionMinutes,
        parentId,
        weight,
        metric,
        primaryGoalId: parentId,
        linkWeight: weight,
      };
      return goalType === "OUTCOME" ? sanitizeOutcome(base) : sanitizeProcess(base);
    }

    if (planType === "STATE") {
      const base = {
        ...next,
        type: goalType,
        planType,
        kind,
        startAt,
        endAt: computeEndAt(startAt, sessionMinutes),
        startDate: undefined,
        oneOffDate: undefined,
        freqUnit: undefined,
        freqCount: undefined,
        sessionMinutes,
        parentId,
        weight,
        metric,
        primaryGoalId: parentId,
        linkWeight: weight,
      };
      return goalType === "OUTCOME" ? sanitizeOutcome(base) : sanitizeProcess(base);
    }

    const freq = normalizeFrequency(next);
    const base = {
      ...next,
      type: goalType,
      planType,
      kind,
      startAt,
      endAt: computeEndAt(startAt, sessionMinutes),
      startDate: undefined,
      oneOffDate: undefined,
      freqUnit: freq.freqUnit,
      freqCount: freq.freqCount,
      sessionMinutes,
      parentId,
      weight,
      metric,
      primaryGoalId: parentId,
      linkWeight: weight,
    };
    return goalType === "OUTCOME" ? sanitizeOutcome(base) : sanitizeProcess(base);
  });

  const orderScore = (x) => (typeof x.order === "number" ? x.order : Number.POSITIVE_INFINITY);
  const prioritaireByCategory = new Map();
  for (const g of normalizedGoals) {
    if (!g || !isOutcome(g)) continue;
    if (!g.categoryId) continue;
    if (g.priority !== "prioritaire") continue;
    const prevBest = prioritaireByCategory.get(g.categoryId);
    if (!prevBest || orderScore(g) < orderScore(prevBest)) prioritaireByCategory.set(g.categoryId, g);
  }

  const priorityNormalizedGoals = normalizedGoals.map((g) => {
    if (!g || !isOutcome(g)) return g;
    if (g.priority !== "prioritaire" || !g.categoryId) return g;
    const pick = prioritaireByCategory.get(g.categoryId);
    if (pick && pick.id === g.id) return g;
    return { ...g, priority: "secondaire" };
  });

  const uiActiveId = state.ui?.activeGoalId || null;
  const uiActiveValid = uiActiveId && priorityNormalizedGoals.some((g) => g?.id === uiActiveId);
  let nextActiveGoalId = uiActiveValid ? uiActiveId : null;

  let nextGoals = priorityNormalizedGoals;
  const isProcessGoal = (g) => isProcess(g);

  if (allowGlobalSingleActive) {
    const activeGoals = priorityNormalizedGoals.filter((g) => g?.status === "active" && isProcessGoal(g));
    let activeId = null;
    if (activeGoals.length === 1) activeId = activeGoals[0].id || null;
    if (activeGoals.length > 1) activeId = pickPreferredActiveId(activeGoals, uiActiveId);
    nextActiveGoalId = activeId || null;

    nextGoals = priorityNormalizedGoals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (!isProcessGoal(g)) return g;
      if (activeId && g.id === activeId) {
        const next = { ...g, status: "active" };
        if (!next.activeSince) next.activeSince = todayKey();
        return next;
      }
      if (g.status === "active") return { ...g, status: "queued" };
      return g;
    });
  } else {
    // Multiple active goals are allowed (especially multiple PROCESS habits).
    nextGoals = priorityNormalizedGoals;
  }

  const activeNow = nextGoals.filter((g) => g?.status === "active");
  const activeProcess = activeNow.filter((g) => isProcess(g));
  nextActiveGoalId = allowGlobalSingleActive
    ? (activeNow.length ? activeNow[0].id || null : null)
    : pickPreferredActiveId(activeProcess.length ? activeProcess : activeNow, uiActiveId);

  const uiMainId = state.ui?.mainGoalId || null;
  const goalsById = new Map(nextGoals.map((g) => [g.id, g]));

  // Main goal is the OUTCOME with priority === "prioritaire" (or null).
  const nextCategories = (state.categories || []).map((cat) => {
    const candidates = nextGoals
      .filter((g) => g && g.categoryId === cat.id)
      .filter((g) => isOutcome(g))
      .filter((g) => g.priority === "prioritaire");
    if (!candidates.length) return { ...cat, mainGoalId: null };
    let best = candidates[0];
    for (const c of candidates.slice(1)) if (orderScore(c) < orderScore(best)) best = c;
    return { ...cat, mainGoalId: best.id };
  });

  const selectedCategoryId = state.ui?.selectedCategoryId || null;
  const resolvedCategoryId =
    selectedCategoryId && nextCategories.some((cat) => cat.id === selectedCategoryId)
      ? selectedCategoryId
      : nextCategories[0]?.id || null;

  const selectedCategory = resolvedCategoryId
    ? nextCategories.find((cat) => cat.id === resolvedCategoryId) || null
    : null;

  // ui.mainGoalId must always reflect the currently selected category only.
  let nextMainGoalId = null;
  if (selectedCategory?.mainGoalId && goalsById.has(selectedCategory.mainGoalId)) {
    nextMainGoalId = selectedCategory.mainGoalId;
  } else if (uiMainId) {
    const g = goalsById.get(uiMainId);
    if (g && g.categoryId === resolvedCategoryId && isOutcome(g)) {
      nextMainGoalId = g.priority === "prioritaire" ? uiMainId : null;
    }
  }

  return {
    ...state,
    goals: nextGoals,
    categories: nextCategories,
    ui: {
      ...(state.ui || {}),
      activeGoalId: nextActiveGoalId,
      mainGoalId: nextMainGoalId,
      selectedCategoryId: resolvedCategoryId,
    },
  };
}

export function getGoalProgress(goal) {
  if (!goal || typeof goal !== "object") return 0;
  if (goal.status === "done") return 1;
  const raw = typeof goal.progress === "string" ? Number(goal.progress) : goal.progress;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(1, raw));
}

export function computeAggregateProgress(state, parentId) {
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  if (!parentId) return { progress: 0, linked: [], aggregate: 0, metric: null };
  const parent = goals.find((g) => g?.id === parentId);
  if (!parent) return { progress: 0, linked: [], aggregate: 0, metric: null };

  const linked = goals
    .filter((g) => g?.parentId === parentId)
    .filter((g) => g?.status === "active" || g?.status === "done")
    .filter((g) => isProcess(g))
    .map((g) => {
      const rawWeight = typeof g?.weight === "string" ? Number(g.weight) : g?.weight;
      const weight = Number.isFinite(rawWeight) ? Math.max(0, Math.min(100, Math.round(rawWeight))) : 100;
      return { goal: g, weight, progress: getGoalProgress(g) };
    });

  const totalWeight = linked.reduce((sum, item) => sum + item.weight, 0);
  const linkedSum = linked.reduce((sum, item) => sum + item.weight * item.progress, 0);
  const aggregate = totalWeight ? linkedSum / totalWeight : 0;

  let metricProgress = null;
  if (isOutcome(parent) && parent?.metric) {
    const targetRaw =
      typeof parent.metric.targetValue === "string"
        ? Number(parent.metric.targetValue)
        : parent.metric.targetValue;
    const currentRaw =
      typeof parent.metric.currentValue === "string"
        ? Number(parent.metric.currentValue)
        : parent.metric.currentValue;
    if (Number.isFinite(targetRaw) && targetRaw > 0) {
      const current = Number.isFinite(currentRaw) ? currentRaw : 0;
      metricProgress = Math.max(0, Math.min(1, current / targetRaw));
    }
  }

  const progress =
    metricProgress == null ? aggregate : Math.max(0, Math.min(1, aggregate * 0.7 + metricProgress * 0.3));

  return { progress, linked, aggregate, metric: metricProgress };
}

// Backward compatibility (deprecated).
export function computePrimaryAggregate(goals = [], primaryId) {
  return computeAggregateProgress({ goals }, primaryId);
}

function getNextOrder(goals) {
  let max = 0;
  for (const g of goals || []) {
    if (typeof g?.order === "number") max = Math.max(max, g.order);
  }
  return max + 1;
}

function canActivate(goal) {
  const s = normalizeStatus(goal?.status);
  return s === "queued" || s === "active";
}

function canFinish(goal) {
  return normalizeStatus(goal?.status) === "active";
}

function canAbandon(goal) {
  return normalizeStatus(goal?.status) === "active";
}

export function createGoal(state, goalInput = {}) {
  if (!state) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const base = { ...goalInput };

  if (typeof base.order !== "number") base.order = getNextOrder(goals);
  const normalized = {
    ...normalizeGoal(base, goals.length, state.categories),
    createdAt: base.createdAt || todayKey(),
  };
  const planType = normalizePlanType(normalized);
  const goalType = normalizeGoalType(normalized, planType);
  const prepared = { ...normalized, planType, type: goalType };
  const nextGoal = goalType === "OUTCOME" ? sanitizeOutcome(prepared) : sanitizeProcess(prepared);

  return normalizeGoalsState({
    ...state,
    goals: [...goals, nextGoal],
  });
}

export function updateGoal(state, goalId, updates = {}) {
  if (!state || !goalId) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  if (!goals.some((g) => g?.id === goalId)) return state;

  const nextGoals = goals.map((g) => {
    if (g?.id !== goalId) return g;
    const candidate = { ...g, ...updates };
    const planType = normalizePlanType(candidate);
    const goalType = normalizeGoalType(candidate, planType);
    const prepared = { ...candidate, planType, type: goalType };
    return goalType === "OUTCOME" ? sanitizeOutcome(prepared) : sanitizeProcess(prepared);
  });

  let adjustedGoals = nextGoals;
  if (updates?.priority === "prioritaire") {
    const updated = nextGoals.find((g) => g?.id === goalId) || null;
    if (isOutcome(updated) && updated?.categoryId) {
      adjustedGoals = nextGoals.map((g) => {
        if (!g || g.id === goalId) return g;
        if (g.categoryId !== updated.categoryId) return g;
        if (!isOutcome(g)) return g;
        if (g.priority === "prioritaire") return { ...g, priority: "secondaire" };
        return g;
      });
    }
  }

  return normalizeGoalsState({ ...state, goals: adjustedGoals });
}

export function preventOverlap(state, candidateGoalId, newStartAt, sessionMinutesOverride) {
  if (!state || !newStartAt) return { ok: true, conflicts: [] };
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const candidate = candidateGoalId ? goals.find((g) => g?.id === candidateGoalId) : null;
  const minutes = Number.isFinite(sessionMinutesOverride)
    ? sessionMinutesOverride
    : Number.isFinite(candidate?.sessionMinutes)
      ? candidate.sessionMinutes
      : null;

  if (!minutes) return { ok: true, conflicts: [] };
  const startMs = parseStartAt(newStartAt);
  if (!startMs) return { ok: true, conflicts: [] };
  const endMs = startMs + minutes * 60 * 1000;

  const conflicts = [];
  for (const g of goals) {
    if (!g || g.id === candidateGoalId) continue;
    if (normalizeStatus(g.status) !== "active") continue;
    const gStart = parseStartAt(g.startAt);
    const gEnd = parseStartAt(resolveGoalEndAt(g));
    if (!gStart || !gEnd) continue;
    const overlaps = startMs < gEnd && gStart < endMs;
    if (overlaps) {
      conflicts.push({
        goalId: g.id,
        title: g.title || g.name || "Objectif",
        startAt: g.startAt || null,
        endAt: resolveGoalEndAt(g),
      });
    }
  }

  return { ok: conflicts.length === 0, conflicts };
}

export function setMainGoal(state, goalId) {
  if (!state) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];

  // Clear main goal for the currently selected category.
  if (!goalId) {
    const catId = state.ui?.selectedCategoryId || null;
    if (!catId) return normalizeGoalsState({ ...state, ui: { ...(state.ui || {}), mainGoalId: null } });

    const nextCategories = (state.categories || []).map((cat) =>
      cat.id === catId ? { ...cat, mainGoalId: null } : cat
    );
    const nextGoals = goals.map((g) => {
      if (!g || g.categoryId !== catId) return g;
      if (g.priority === "prioritaire") return { ...g, priority: "secondaire" };
      return g;
    });
    const nextUi = { ...(state.ui || {}), mainGoalId: null, selectedCategoryId: catId };
    return normalizeGoalsState({ ...state, categories: nextCategories, goals: nextGoals, ui: nextUi });
  }

  const goal = goals.find((g) => g?.id === goalId) || null;
  if (!goal || !goal.categoryId) return state;

  // Only OUTCOME goals can be set as main.
  if (!isOutcome(goal)) return state;

  // One "prioritaire" per category.
  const nextGoals = goals.map((g) => {
    if (!g || g.categoryId !== goal.categoryId) return g;
    if (g.id === goalId) return { ...g, priority: "prioritaire" };
    if (g.priority === "prioritaire") return { ...g, priority: "secondaire" };
    return g;
  });

  const nextUi = {
    ...(state.ui || {}),
    mainGoalId: goalId,
    selectedCategoryId: goal.categoryId,
  };

  return normalizeGoalsState({ ...state, goals: nextGoals, ui: nextUi });
}

export function linkChild(state, childId, parentId, weight) {
  if (!state || !childId) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  if (!goals.some((g) => g?.id === childId)) return state;
  const cleanParent = typeof parentId === "string" && parentId.trim() ? parentId : null;
  const rawWeight = typeof weight === "string" ? Number(weight) : weight;
  const cleanWeight =
    cleanParent && Number.isFinite(rawWeight) ? Math.max(0, Math.min(100, Math.round(rawWeight))) : 0;

  const nextGoals = goals.map((g) => {
    if (g?.id !== childId) return g;
    return {
      ...g,
      parentId: cleanParent,
      primaryGoalId: cleanParent,
      weight: cleanWeight,
      linkWeight: cleanWeight,
    };
  });
  return normalizeGoalsState({ ...state, goals: nextGoals });
}

export function scheduleStart(state, goalId, startAt, sessionMinutes) {
  if (!state || !goalId) return { ok: false, conflicts: [], state };
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g?.id === goalId);
  if (!goal) return { ok: false, conflicts: [], state };

  const cleanStartAt = typeof startAt === "string" ? startAt.trim() : "";
  if (!cleanStartAt) return { ok: false, conflicts: [], state };

  const minutes = Number.isFinite(sessionMinutes)
    ? sessionMinutes
    : Number.isFinite(goal?.sessionMinutes)
      ? goal.sessionMinutes
      : null;

  const overlap = preventOverlap(state, goalId, cleanStartAt, minutes);
  if (!overlap.ok) return { ok: false, conflicts: overlap.conflicts, state };

  const nextGoals = goals.map((g) => {
    if (g?.id !== goalId) return g;
    return {
      ...g,
      startAt: cleanStartAt,
      sessionMinutes: Number.isFinite(sessionMinutes) ? sessionMinutes : g.sessionMinutes,
      endAt: computeEndAt(cleanStartAt, Number.isFinite(sessionMinutes) ? sessionMinutes : g.sessionMinutes),
    };
  });

  return { ok: true, state: normalizeGoalsState({ ...state, goals: nextGoals }) };
}

/**
 * Action centrale : activer un objectif/action
 * - Plusieurs actifs autorisés (notamment plusieurs PROCESS)
 * - Unicité "single active" (si activée un jour) ne concerne que PROCESS.
 */
export function activateGoal(state, goalId, opts = { navigate: true }) {
  if (!state) return { ok: false, reason: "NO_STATE", blockers: [], conflicts: [], state };
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g?.id === goalId);
  if (!goal || !goalId) return { ok: false, reason: "NOT_FOUND", blockers: [], conflicts: [], state };
  if (!canActivate(goal)) return { ok: false, reason: "INVALID_STATUS", blockers: [], conflicts: [], state };
  if (goal.status === "active") return { ok: true, state };

  const planType = normalizePlanType(goal);
  const goalType = normalizeGoalType(goal, planType);
  const isProcessType = goalType === "PROCESS";
  const isProcessGoal = (x) => isProcess(x);

  // If we ever enforce a global single active goal, it only makes sense for PROCESS goals (habits/actions).
  const blockers =
    isProcessType && allowGlobalSingleActive
      ? goals.filter((g) => {
          if (!g || g.id === goalId) return false;
          if (!isProcessGoal(g)) return false;
          return normalizeStatus(g.status) === "active";
        })
      : [];

  if (blockers.length > 0) {
    return {
      ok: false,
      reason: "BLOCKED",
      blockers,
      conflicts: [],
      state,
    };
  }

  // Time overlap checks apply to PROCESS (scheduled action sessions), not OUTCOME.
  if (isProcessType) {
    const overlap = preventOverlap(state, goalId, goal.startAt, goal.sessionMinutes);
    if (!overlap.ok) {
      return {
        ok: false,
        reason: "OVERLAP",
        blockers: [],
        conflicts: overlap.conflicts,
        state,
      };
    }
  }

  const nextGoals = goals.map((g) => {
    if (!g || typeof g !== "object") return g;
    if (g.id === goalId) {
      return { ...g, status: "active", activeSince: g.activeSince || todayKey() };
    }
    if (allowGlobalSingleActive && isProcessType && isProcessGoal(g) && normalizeStatus(g.status) === "active") {
      return { ...g, status: "queued" };
    }
    return g;
  });

  const nextUi = {
    ...(state.ui || {}),
    activeGoalId: goalId,
  };
  if (opts?.navigate !== false) {
    nextUi.selectedCategoryId = goal.categoryId || state.ui?.selectedCategoryId;
  }

  return {
    ok: true,
    state: normalizeGoalsState({
      ...state,
      goals: nextGoals,
      ui: nextUi,
    }),
  };
}

/**
 * Action centrale : terminer un objectif actif
 * - active -> done
 * - libère activeGoalId
 */
export function finishGoal(state, goalId) {
  if (!state) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g?.id === goalId);
  if (!goal || !goalId) return state;
  if (!canFinish(goal)) return state;

  const nextGoals = goals.map((g) => {
    if (!g || typeof g !== "object") return g;
    if (g.id !== goalId) return g;
    return { ...g, status: "done", completedAt: todayKey() };
  });

  const nextUi = {
    ...(state.ui || {}),
    activeGoalId: state.ui?.activeGoalId === goalId ? null : state.ui?.activeGoalId,
  };

  return normalizeGoalsState({
    ...state,
    goals: nextGoals,
    ui: nextUi,
  });
}

/**
 * Action centrale : abandonner un objectif actif
 * - active -> invalid (ou queued si resetPolicy=reset)
 * - libère activeGoalId
 */
export function abandonGoal(state, goalId) {
  if (!state) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g?.id === goalId);
  if (!goal || !goalId) return state;
  if (!canAbandon(goal)) return state;

  const policy = normalizeResetPolicy(goal.resetPolicy);
  const nextGoals = goals.map((g) => {
    if (!g || typeof g !== "object") return g;
    if (g.id !== goalId) return g;
    if (policy === "reset") return { ...g, status: "queued" };
    return { ...g, status: "invalid" };
  });

  const nextUi = {
    ...(state.ui || {}),
    activeGoalId: state.ui?.activeGoalId === goalId ? null : state.ui?.activeGoalId,
  };

  return normalizeGoalsState({
    ...state,
    goals: nextGoals,
    ui: nextUi,
  });
}

export function deleteGoal(state, goalId) {
  if (!state) return state;
  if (!goalId) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  if (!goals.some((g) => g?.id === goalId)) return state;

  const nextGoals = goals.filter((g) => g?.id !== goalId);
  const nextUi = { ...(state.ui || {}) };
  if (nextUi.activeGoalId === goalId) nextUi.activeGoalId = null;
  if (nextUi.openGoalEditId === goalId) nextUi.openGoalEditId = null;

  return normalizeGoalsState({
    ...state,
    goals: nextGoals,
    ui: nextUi,
  });
}

export function autoActivateScheduledGoals(state, now = new Date()) {
  if (!state) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  if (!goals.length) return state;

  const nowMs = now.getTime();
  const byCategory = new Map();
  for (const g of goals) {
    if (!g?.categoryId) continue;
    const list = byCategory.get(g.categoryId) || [];
    list.push(g);
    byCategory.set(g.categoryId, list);
  }

  let changed = false;
  let nextGoals = goals.map((g) => ({ ...g }));

  for (const [categoryId, list] of byCategory.entries()) {
    const hasActive = list.some((g) => normalizeStatus(g.status) === "active" && isProcess(g));
    if (hasActive) continue;

    const candidates = list
      .filter((g) => normalizeStatus(g.status) === "queued")
      .filter((g) => {
        const planType = normalizePlanType(g);
        const goalType = normalizeGoalType(g, planType);
        return planType === "ACTION" && goalType === "PROCESS";
      })
      .map((g) => ({ goal: g, startAt: parseStartAt(g.startAt) ?? nowMs }))
      .filter((g) => g.startAt <= nowMs)
      .sort((a, b) => a.startAt - b.startAt);

    const pick = candidates[0];
    if (!pick) continue;

    nextGoals = nextGoals.map((g) => {
      if (!g || g.categoryId !== categoryId) return g;
      if (g.id === pick.goal.id) {
        return { ...g, status: "active", activeSince: g.activeSince || todayKey() };
      }
      return g;
    });
    changed = true;
  }

  if (!changed) return state;
  return normalizeGoalsState({ ...state, goals: nextGoals });
}

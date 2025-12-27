// src/logic/goals.js
import { todayKey } from "../utils/dates";
import { normalizeGoal, normalizeResetPolicy } from "./state";

const ALLOWED = new Set(["queued", "active", "done", "invalid"]);
const GOAL_TYPES = new Set(["ACTION", "ONE_OFF", "STATE"]);

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

function normalizeGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (GOAL_TYPES.has(raw)) return raw;
  if (goal?.oneOffDate || goal?.freqUnit === "ONCE") return "ONE_OFF";
  if (goal?.freqUnit || goal?.freqCount || goal?.cadence) return "ACTION";
  return "STATE";
}

function normalizeStartAt(goal, nowLocal) {
  const raw = typeof goal?.startAt === "string" ? goal.startAt.trim() : "";
  if (raw) return raw;
  const legacy = typeof goal?.startDate === "string" ? goal.startDate.trim() : "";
  if (legacy) return `${legacy}T09:00`;
  return nowLocal;
}

function normalizeOneOffDate(goal) {
  const raw = typeof goal?.oneOffDate === "string" ? goal.oneOffDate.trim() : "";
  if (raw) return raw;
  const fallback = typeof goal?.deadline === "string" ? goal.deadline.trim() : "";
  return fallback;
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
    const type = normalizeGoalType(next);
    const startAt = normalizeStartAt(next, nowLocal);
    if (type === "ONE_OFF") {
      return {
        ...next,
        type,
        startAt,
        startDate: undefined,
        oneOffDate: normalizeOneOffDate(next),
        freqUnit: undefined,
        freqCount: undefined,
        sessionMinutes: undefined,
      };
    }
    if (type === "STATE") {
      return {
        ...next,
        type,
        startAt,
        startDate: undefined,
        freqUnit: undefined,
        freqCount: undefined,
        sessionMinutes: undefined,
      };
    }
    const freq = normalizeFrequency(next);
    const sessionMinutes = normalizeSessionMinutes(next);
    return {
      ...next,
      type,
      startAt,
      startDate: undefined,
      freqUnit: freq.freqUnit,
      freqCount: freq.freqCount,
      sessionMinutes,
    };
  });

  const uiActiveId = state.ui?.activeGoalId || null;
  const uiActiveValid = uiActiveId && normalizedGoals.some((g) => g?.id === uiActiveId);
  let nextActiveGoalId = uiActiveValid ? uiActiveId : null;

  let nextGoals = normalizedGoals;
  if (allowGlobalSingleActive) {
    const activeGoals = normalizedGoals.filter((g) => g?.status === "active");
    let activeId = null;
    if (activeGoals.length === 1) activeId = activeGoals[0].id || null;
    if (activeGoals.length > 1) activeId = pickPreferredActiveId(activeGoals, uiActiveId);
    nextActiveGoalId = activeId || null;

    nextGoals = normalizedGoals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (activeId && g.id === activeId) {
        const next = { ...g, status: "active" };
        if (!next.activeSince) next.activeSince = todayKey();
        return next;
      }
      if (g.status === "active") return { ...g, status: "queued" };
      return g;
    });
  } else {
    const activeByCategory = new Map();
    for (const g of normalizedGoals) {
      if (g?.status !== "active") continue;
      const key = g?.categoryId || "__none__";
      const list = activeByCategory.get(key) || [];
      list.push(g);
      activeByCategory.set(key, list);
    }

    const chosenActiveIds = new Set();
    for (const [key, list] of activeByCategory.entries()) {
      const preferred = list.some((g) => g?.id === uiActiveId) ? uiActiveId : null;
      const picked = pickPreferredActiveId(list, preferred);
      if (picked) chosenActiveIds.add(picked);
    }

    nextGoals = normalizedGoals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (g.status !== "active") return g;
      if (chosenActiveIds.has(g.id)) {
        const next = { ...g, status: "active" };
        if (!next.activeSince) next.activeSince = todayKey();
        return next;
      }
      return { ...g, status: "queued" };
    });
  }

  const activeNow = nextGoals.filter((g) => g?.status === "active");
  if (allowGlobalSingleActive) {
    nextActiveGoalId = activeNow.length ? activeNow[0].id || null : null;
  } else {
    nextActiveGoalId = pickPreferredActiveId(activeNow, uiActiveId);
  }

  const uiMainId = state.ui?.mainGoalId || null;
  const mainIsActive = uiMainId && activeNow.some((g) => g?.id === uiMainId);
  let nextMainGoalId = mainIsActive ? uiMainId : null;
  if (!nextMainGoalId && activeNow.length) {
    nextMainGoalId = pickOldestActiveId(activeNow);
  }

  return {
    ...state,
    goals: nextGoals,
    ui: { ...(state.ui || {}), activeGoalId: nextActiveGoalId, mainGoalId: nextMainGoalId },
  };
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
  const nextGoal = {
    ...normalizeGoal(base, goals.length),
    createdAt: base.createdAt || todayKey(),
  };

  return normalizeGoalsState({
    ...state,
    goals: [...goals, nextGoal],
  });
}

export function updateGoal(state, goalId, updates = {}) {
  if (!state || !goalId) return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  if (!goals.some((g) => g?.id === goalId)) return state;

  const nextGoals = goals.map((g) => (g?.id === goalId ? { ...g, ...updates } : g));
  return normalizeGoalsState({ ...state, goals: nextGoals });
}

/**
 * Action centrale : activer un objectif
 * - 1 seul "active" par catégorie
 * - interdit si goal = done/invalid
 */
export function activateGoal(state, goalId, opts = { navigate: true }) {
  if (!state) return { ok: false, reason: "NO_STATE", blockers: [], state };
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const goal = goals.find((g) => g?.id === goalId);
  if (!goal || !goalId) return { ok: false, reason: "NOT_FOUND", blockers: [], state };
  if (!canActivate(goal)) return { ok: false, reason: "INVALID_STATUS", blockers: [], state };
  if (goal.status === "active") return { ok: true, state };

  const now = opts?.now instanceof Date ? opts.now : new Date();
  const nowMs = now.getTime();
  const startAtMs = parseStartAt(goal.startAt) ?? nowMs;
  const inFuture = startAtMs > nowMs;

  const blockers = goals.filter((g) => {
    if (!g || g.id === goalId) return false;
    if (g.categoryId !== goal.categoryId) return false;
    if (normalizeStatus(g.status) === "active") return true;
    if (normalizeStatus(g.status) !== "queued") return false;
    const gStart = parseStartAt(g.startAt) ?? nowMs;
    return gStart <= nowMs;
  });

  if (inFuture || blockers.length > 0) {
    return {
      ok: false,
      reason: inFuture ? "START_IN_FUTURE" : "BLOCKED",
      blockers,
      state,
    };
  }

  const nextGoals = goals.map((g) => {
    if (!g || typeof g !== "object") return g;
    if (g.id === goalId) {
      return { ...g, status: "active", activeSince: g.activeSince || todayKey() };
    }
    if (normalizeStatus(g.status) === "active") {
      if (allowGlobalSingleActive) return { ...g, status: "queued" };
      if (g.categoryId === goal.categoryId) return { ...g, status: "queued" };
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
    const hasActive = list.some((g) => normalizeStatus(g.status) === "active");
    if (hasActive) continue;

    const candidates = list
      .filter((g) => normalizeStatus(g.status) === "queued")
      .filter((g) => normalizeGoalType(g) === "ACTION")
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

import { normalizeLocalDateKey } from "../utils/dateKey";
import { CREATION_STEPS, STEP_HABITS, STEP_OUTCOME } from "./creationSchema";

export const CREATION_DRAFT_VERSION = 1;
const REPEAT_VALUES = new Set(["none", "daily", "weekly"]);
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]);

function normalizeRepeat(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return REPEAT_VALUES.has(raw) ? raw : "";
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const v of value) {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n)) continue;
    const id = Math.trunc(n);
    if (!DOW_VALUES.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeStartTime(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
}

function normalizeDurationMinutes(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

export function createEmptyDraft() {
  return {
    version: CREATION_DRAFT_VERSION,
    step: STEP_OUTCOME,
    category: null,
    outcome: null,
    outcomes: [],
    activeOutcomeId: null,
    habits: [],
  };
}

export function normalizeCreationDraft(raw) {
  const draft = raw && typeof raw === "object" ? { ...raw } : createEmptyDraft();
  if (draft.version !== CREATION_DRAFT_VERSION) draft.version = CREATION_DRAFT_VERSION;
  if (!CREATION_STEPS.includes(draft.step)) draft.step = STEP_OUTCOME;
  if (!draft.category || typeof draft.category !== "object") draft.category = null;
  if (!draft.outcome || typeof draft.outcome !== "object") draft.outcome = null;
  if (!Array.isArray(draft.outcomes)) {
    if (draft.outcome) {
      const legacyId = draft.outcome.id || "outcome";
      draft.outcomes = [{ ...draft.outcome, id: legacyId }];
    } else {
      draft.outcomes = [];
    }
  }
  draft.outcomes = draft.outcomes
    .map((outcome, index) => {
      if (!outcome || typeof outcome !== "object") return null;
      const nextOutcome = { ...outcome };
      if (!nextOutcome.id) nextOutcome.id = `outcome-${index + 1}`;
      if ("measureType" in nextOutcome) delete nextOutcome.measureType;
      if ("targetValue" in nextOutcome) delete nextOutcome.targetValue;
      if ("currentValue" in nextOutcome) delete nextOutcome.currentValue;
      if ("metric" in nextOutcome) delete nextOutcome.metric;
      return nextOutcome;
    })
    .filter(Boolean);
  if (!draft.activeOutcomeId || !draft.outcomes.some((o) => o.id === draft.activeOutcomeId)) {
    draft.activeOutcomeId = draft.outcomes[0]?.id || null;
  }
  if (!Array.isArray(draft.habits)) draft.habits = [];
  draft.habits = draft.habits
    .map((habit) => {
      if (!habit || typeof habit !== "object") return null;
      const nextHabit = { ...habit };
      if (!nextHabit.outcomeId && draft.outcomes.length === 1) {
        nextHabit.outcomeId = draft.outcomes[0].id;
      }
      const repeat = normalizeRepeat(nextHabit.repeat);
      nextHabit.repeat = repeat || "none";
      nextHabit.daysOfWeek = normalizeDaysOfWeek(nextHabit.daysOfWeek);
      nextHabit.startTime = normalizeStartTime(nextHabit.startTime);
      nextHabit.durationMinutes = normalizeDurationMinutes(nextHabit.durationMinutes);
      const normalizedDate = normalizeLocalDateKey(nextHabit.oneOffDate);
      nextHabit.oneOffDate = repeat === "none" ? normalizedDate || "" : "";
      return nextHabit;
    })
    .filter(Boolean);
  return draft;
}

export function ensureDraftStep(draft, step) {
  const safe = normalizeCreationDraft(draft);
  if (CREATION_STEPS.includes(step)) safe.step = step;
  return safe;
}

export const DRAFT_SECTIONS = {
  outcome: STEP_OUTCOME,
  habits: STEP_HABITS,
};

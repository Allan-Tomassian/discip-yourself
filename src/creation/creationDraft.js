import { normalizeLocalDateKey } from "../utils/dateKey";
import { normalizeTimeFields } from "../logic/timeFields";
import {
  CREATION_STEPS,
  STEP_HABITS,
  STEP_OUTCOME,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
  STEP_OUTCOME_NEXT_ACTION,
} from "./creationSchema";

export const CREATION_DRAFT_VERSION = 1;
const REPEAT_VALUES = new Set(["none", "daily", "weekly"]);
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]);
const QUANTITY_PERIODS = new Set(["DAY", "WEEK", "MONTH"]);

const HABIT_TYPES = new Set(["ONE_OFF", "RECURRING", "ANYTIME"]);
const SCHEDULE_MODES = new Set(["STANDARD", "WEEKLY_SLOTS"]);

function normalizeHabitType(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return HABIT_TYPES.has(raw) ? raw : null;
}

function normalizeScheduleMode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SCHEDULE_MODES.has(raw) ? raw : "";
}

function normalizeWeeklySlotsByDay(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const k of Object.keys(value)) {
    const day = String(k).trim();
    if (!/^[1-7]$/.test(day)) continue;
    const arr = value[k];
    if (!Array.isArray(arr)) continue;
    const clean = [];
    for (const slot of arr) {
      if (!slot || typeof slot !== "object") continue;
      const start = typeof slot.start === "string" ? slot.start.trim() : "";
      const end = typeof slot.end === "string" ? slot.end.trim() : "";
      if (!start && !end) continue;
      clean.push({ start, end });
    }
    if (clean.length) out[day] = clean;
  }
  return out;
}

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

function normalizeQuantityValue(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

function normalizeQuantityUnit(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw;
}

function normalizeQuantityPeriod(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return QUANTITY_PERIODS.has(raw) ? raw : "";
}

export function createEmptyDraft() {
  return {
    version: CREATION_DRAFT_VERSION,
    step: STEP_OUTCOME,
    habitType: null,
    category: null,
    outcome: null,
    outcomes: [],
    activeOutcomeId: null,
    createdOutcomeId: null,
    habits: [],
    createdActionIds: [],
    pendingCategoryId: null,
  };
}

export function normalizeCreationDraft(raw) {
  const draft = raw && typeof raw === "object" ? { ...raw } : createEmptyDraft();
  if (draft.version !== CREATION_DRAFT_VERSION) draft.version = CREATION_DRAFT_VERSION;
  if (!CREATION_STEPS.includes(draft.step)) draft.step = STEP_OUTCOME;
  draft.habitType = normalizeHabitType(draft.habitType);
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
  const activeOutcomeId = typeof draft.activeOutcomeId === "string" ? draft.activeOutcomeId.trim() : "";
  if (!activeOutcomeId) {
    draft.activeOutcomeId = draft.outcomes[0]?.id || null;
  } else {
    draft.activeOutcomeId = activeOutcomeId;
  }
  if (!Array.isArray(draft.habits)) draft.habits = [];
  draft.createdOutcomeId = typeof draft.createdOutcomeId === "string" ? draft.createdOutcomeId.trim() : "";
  if (!draft.createdOutcomeId) draft.createdOutcomeId = null;
  if (!Array.isArray(draft.createdActionIds)) {
    const legacy = typeof draft.createdActionId === "string" ? [draft.createdActionId] : [];
    draft.createdActionIds = legacy;
  }
  draft.createdActionIds = draft.createdActionIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
  if (typeof draft.pendingCategoryId !== "string") draft.pendingCategoryId = null;
  draft.habits = draft.habits
    .map((habit) => {
      if (!habit || typeof habit !== "object") return null;
      const nextHabit = { ...habit };
      nextHabit.outcomeId = typeof nextHabit.outcomeId === "string" ? nextHabit.outcomeId : "";
      if (!nextHabit.outcomeId && draft.outcomes.length === 1) {
        nextHabit.outcomeId = draft.outcomes[0].id;
      }
      const repeat = normalizeRepeat(nextHabit.repeat);
      nextHabit.repeat = repeat || "none";
      nextHabit.daysOfWeek = normalizeDaysOfWeek(nextHabit.daysOfWeek);
      nextHabit.startTime = normalizeStartTime(nextHabit.startTime);
      nextHabit.durationMinutes = normalizeDurationMinutes(nextHabit.durationMinutes);

      // Enforce habitType invariants at the draft level to avoid legacy / mixed states.
      // ANYTIME: no fixed planning; treat as daily availability without time/slots.
      // ONE_OFF: must be a one-off; no weekly slots.
      if (draft.habitType === "ANYTIME") {
        nextHabit.repeat = "daily";
        nextHabit.daysOfWeek = [];
        nextHabit.oneOffDate = "";
        nextHabit.scheduleMode = "STANDARD";
        nextHabit.weeklySlotsByDay = {};
        nextHabit.timeMode = "NONE";
        nextHabit.timeSlots = [];
        nextHabit.startTime = "";
      } else if (draft.habitType === "ONE_OFF") {
        nextHabit.repeat = "none";
        nextHabit.daysOfWeek = [];
        nextHabit.scheduleMode = "STANDARD";
        nextHabit.weeklySlotsByDay = {};
      }

      // Advanced scheduling (weekly slots by day)
      const scheduleMode =
        normalizeScheduleMode(nextHabit.scheduleMode) ||
        normalizeScheduleMode(nextHabit.schedule?.scheduleMode);
      nextHabit.scheduleMode = scheduleMode || "STANDARD";
      // Only weekly habits can use WEEKLY_SLOTS.
      if (nextHabit.repeat !== "weekly") {
        nextHabit.scheduleMode = "STANDARD";
      }
      if (nextHabit.scheduleMode !== "WEEKLY_SLOTS") {
        nextHabit.weeklySlotsByDay = {};
      }
      const normalizedDate = normalizeLocalDateKey(nextHabit.oneOffDate);
      nextHabit.oneOffDate = nextHabit.repeat === "none" ? normalizedDate || "" : "";
      const quantityValue = normalizeQuantityValue(nextHabit.quantityValue);
      const quantityUnit = normalizeQuantityUnit(nextHabit.quantityUnit);
      const quantityPeriod = normalizeQuantityPeriod(nextHabit.quantityPeriod);
      if (quantityValue && quantityUnit) {
        nextHabit.quantityValue = quantityValue;
        nextHabit.quantityUnit = quantityUnit;
        nextHabit.quantityPeriod = quantityPeriod || "DAY";
      } else {
        nextHabit.quantityValue = null;
        nextHabit.quantityUnit = "";
        nextHabit.quantityPeriod = "";
      }
      nextHabit.reminderTime = normalizeStartTime(nextHabit.reminderTime);
      nextHabit.reminderWindowStart = normalizeStartTime(nextHabit.reminderWindowStart);
      nextHabit.reminderWindowEnd = normalizeStartTime(nextHabit.reminderWindowEnd);
      if (!nextHabit.reminderTime) {
        nextHabit.reminderWindowStart = "";
        nextHabit.reminderWindowEnd = "";
      }
      const timeFields = normalizeTimeFields({
        timeMode: nextHabit.timeMode,
        timeSlots: nextHabit.timeSlots,
        startTime: nextHabit.startTime,
        reminderTime: nextHabit.reminderTime,
      });
      nextHabit.timeMode = timeFields.timeMode;
      nextHabit.timeSlots = timeFields.timeSlots;
      nextHabit.startTime = timeFields.startTime;
      nextHabit.memo = typeof nextHabit.memo === "string" ? nextHabit.memo : "";
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
  outcomeNext: STEP_OUTCOME_NEXT_ACTION,
  habits: STEP_HABITS,
  linkOutcome: STEP_LINK_OUTCOME,
  pickCategory: STEP_PICK_CATEGORY,
};

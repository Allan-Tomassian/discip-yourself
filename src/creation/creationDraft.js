import { normalizeLocalDateKey, normalizeStartTime } from "../utils/datetime";
import { normalizeTimeFields } from "../logic/timeFields";
import {
  CREATION_STEPS,
  STEP_HABITS,
  STEP_OUTCOME,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
  STEP_OUTCOME_NEXT_ACTION,
} from "./creationSchema";

export const CREATION_DRAFT_VERSION = 2;
const REPEAT_VALUES = new Set(["none", "daily", "weekly"]);
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]);
const QUANTITY_PERIODS = new Set(["DAY", "WEEK", "MONTH"]);

const HABIT_TYPES = new Set(["ONE_OFF", "RECURRING", "ANYTIME"]);

// New UX v2 planning modes (source of truth in draft)
// - NO_TIME: due that day, no scheduling
// - UNIFORM_TIME: same time for all expected days
// - DAY_SLOTS: different slots per day
const PLANNING_MODES = new Set(["NO_TIME", "UNIFORM_TIME", "DAY_SLOTS"]);

// Legacy schedule modes still accepted for migration parsing
const SCHEDULE_MODES = new Set(["STANDARD", "WEEKLY_SLOTS"]);
function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
    if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  }
  return false;
}

function normalizePlanningMode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PLANNING_MODES.has(raw) ? raw : "";
}

function normalizeDaySlotsByDay(value) {
  // Same structure as legacy weeklySlotsByDay, but renamed for UX v2.
  return normalizeWeeklySlotsByDay(value);
}

function deriveExpectedDaysFromLegacy(nextHabit) {
  // Legacy: daily => all days, weekly => daysOfWeek.
  const rep = normalizeRepeat(nextHabit.repeat) || "";
  if (rep === "daily") return [1, 2, 3, 4, 5, 6, 7];
  if (rep === "weekly") return normalizeDaysOfWeek(nextHabit.daysOfWeek);
  return [];
}

function deriveLegacyRepeatFromExpectedDays(expectedDays) {
  const days = Array.isArray(expectedDays) ? expectedDays : [];
  if (days.length === 7) return "daily";
  if (days.length > 0) return "weekly";
  return "none";
}

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
    // UX v2 flags (default off until App enables uxV2)
    uxV2: false,
  };
}

export function normalizeCreationDraft(raw) {
  const draft = raw && typeof raw === "object" ? { ...raw } : createEmptyDraft();
  if (draft.version !== CREATION_DRAFT_VERSION) draft.version = CREATION_DRAFT_VERSION;
  draft.uxV2 = normalizeBoolean(draft.uxV2);
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

      // UX v2 fields (source of truth in draft)
      const rawExpected = nextHabit.expectedDays;
      nextHabit.expectedDays = normalizeDaysOfWeek(rawExpected);

      // If expectedDays is missing/empty, derive from legacy repeat/daysOfWeek.
      if (nextHabit.expectedDays.length === 0) {
        nextHabit.expectedDays = deriveExpectedDaysFromLegacy(nextHabit);
      }

      nextHabit.anytimeFlexible = normalizeBoolean(
        nextHabit.anytimeFlexible ?? nextHabit.schedule?.anytimeFlexible
      );

      // Day slots per day (UX v2). If missing, migrate from legacy weeklySlotsByDay.
      nextHabit.daySlotsByDay = normalizeDaySlotsByDay(
        nextHabit.daySlotsByDay || nextHabit.weeklySlotsByDay || nextHabit.schedule?.weeklySlotsByDay
      );

      // Planning mode (UX v2). If missing, infer from legacy schedule/time fields.
      const inferredPlanning = (() => {
        const pm = normalizePlanningMode(nextHabit.planningMode);
        if (pm) return pm;
        const legacyScheduleMode =
          normalizeScheduleMode(nextHabit.scheduleMode) ||
          normalizeScheduleMode(nextHabit.schedule?.scheduleMode);
        if (legacyScheduleMode === "WEEKLY_SLOTS") return "DAY_SLOTS";
        const legacyHasFixedTime =
          !!normalizeStartTime(nextHabit.startTime) ||
          (Array.isArray(nextHabit.timeSlots) && nextHabit.timeSlots.length > 0) ||
          nextHabit.timeMode === "FIXED";
        if (legacyHasFixedTime && (nextHabit.timeMode === "FIXED" || normalizeStartTime(nextHabit.startTime))) {
          return "UNIFORM_TIME";
        }
        // default
        return "NO_TIME";
      })();
      nextHabit.planningMode = inferredPlanning;

      // Legacy compatibility: keep repeat + daysOfWeek in sync with expectedDays
      nextHabit.daysOfWeek = [...nextHabit.expectedDays];
      nextHabit.repeat = deriveLegacyRepeatFromExpectedDays(nextHabit.expectedDays);

      nextHabit.startTime = normalizeStartTime(nextHabit.startTime);
      nextHabit.durationMinutes = normalizeDurationMinutes(nextHabit.durationMinutes);

      // Enforce UX v2 invariants at the draft level.
      // ONE_OFF: due on a single date, no expectedDays, no per-day slots.
      // RECURRING: expectedDays required (UI enforces), planning optional.
      // ANYTIME: no scheduling; may be expected on days OR flexible (no days, never "missed").
      if (draft.habitType === "ONE_OFF") {
        nextHabit.anytimeFlexible = false;
        nextHabit.expectedDays = [];
        nextHabit.daysOfWeek = [];
        nextHabit.repeat = "none";
        nextHabit.planningMode = nextHabit.planningMode === "UNIFORM_TIME" ? "UNIFORM_TIME" : "NO_TIME";
        nextHabit.daySlotsByDay = {};
        nextHabit.scheduleMode = "STANDARD";
        nextHabit.weeklySlotsByDay = {};
      } else if (draft.habitType === "ANYTIME") {
        // Anytime never uses scheduling fields.
        nextHabit.planningMode = "NO_TIME";
        nextHabit.daySlotsByDay = {};
        nextHabit.scheduleMode = "STANDARD";
        nextHabit.weeklySlotsByDay = {};
        nextHabit.timeMode = "NONE";
        nextHabit.timeSlots = [];
        nextHabit.startTime = "";
        // Flexible anytime: no expectedDays.
        if (nextHabit.anytimeFlexible) {
          nextHabit.expectedDays = [];
          nextHabit.daysOfWeek = [];
          nextHabit.repeat = "none";
        } else {
          // Expected anytime: use expectedDays; keep legacy mapping synced.
          nextHabit.daysOfWeek = [...nextHabit.expectedDays];
          nextHabit.repeat = deriveLegacyRepeatFromExpectedDays(nextHabit.expectedDays);
        }
      } else if (draft.habitType === "RECURRING") {
        nextHabit.anytimeFlexible = false;
        // planningMode DAY_SLOTS implies per-day slots; keep legacy weeklySlotsByDay for compatibility
        if (nextHabit.planningMode === "DAY_SLOTS") {
          nextHabit.weeklySlotsByDay = normalizeWeeklySlotsByDay(nextHabit.daySlotsByDay);
          nextHabit.scheduleMode = "WEEKLY_SLOTS";
        } else {
          nextHabit.weeklySlotsByDay = {};
          nextHabit.scheduleMode = "STANDARD";
        }
        // Keep legacy mapping synced
        nextHabit.daysOfWeek = [...nextHabit.expectedDays];
        nextHabit.repeat = deriveLegacyRepeatFromExpectedDays(nextHabit.expectedDays);
      }

      // Legacy scheduling fields kept for compatibility (driven by planningMode above)
      const scheduleMode =
        normalizeScheduleMode(nextHabit.scheduleMode) ||
        normalizeScheduleMode(nextHabit.schedule?.scheduleMode);
      nextHabit.scheduleMode = scheduleMode || nextHabit.scheduleMode || "STANDARD";
      if (nextHabit.scheduleMode !== "WEEKLY_SLOTS") {
        nextHabit.weeklySlotsByDay = {};
      }

      const normalizedDate = normalizeLocalDateKey(nextHabit.oneOffDate);
      nextHabit.oneOffDate = draft.habitType === "ONE_OFF" ? normalizedDate || "" : "";

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
      if (draft.habitType === "ANYTIME") {
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
      if (draft.habitType === "ANYTIME") {
        nextHabit.timeMode = "NONE";
        nextHabit.timeSlots = [];
        nextHabit.startTime = "";
      }
      // Enforce scheduling invariants based on UX v2 planningMode.
      // Goal: avoid double-scheduling (e.g., DAY_SLOTS + FIXED time) and keep legacy fields coherent.
      if (draft.habitType === "ONE_OFF") {
        // ONE_OFF only supports optional uniform time; otherwise it is due that day with no time.
        if (nextHabit.planningMode !== "UNIFORM_TIME") {
          nextHabit.timeMode = "NONE";
          nextHabit.timeSlots = [];
          nextHabit.startTime = "";
        } else {
          // Uniform time: if user set a startTime, keep it as FIXED for legacy compatibility.
          if (nextHabit.startTime) nextHabit.timeMode = "FIXED";
        }
      }

      if (draft.habitType === "RECURRING") {
        // RECURRING supports: NO_TIME, UNIFORM_TIME, or DAY_SLOTS.
        // NO_TIME and DAY_SLOTS must never keep legacy fixed time fields.
        if (nextHabit.planningMode === "NO_TIME" || nextHabit.planningMode === "DAY_SLOTS") {
          nextHabit.timeMode = "NONE";
          nextHabit.timeSlots = [];
          nextHabit.startTime = "";
        } else if (nextHabit.planningMode === "UNIFORM_TIME") {
          if (nextHabit.startTime) nextHabit.timeMode = "FIXED";
        }

        // DAY_SLOTS implies legacy WEEKLY_SLOTS schedule mode + weeklySlotsByDay.
        if (nextHabit.planningMode === "DAY_SLOTS") {
          nextHabit.scheduleMode = "WEEKLY_SLOTS";
          nextHabit.weeklySlotsByDay = normalizeWeeklySlotsByDay(nextHabit.daySlotsByDay);
        } else {
          // Other modes should not retain weekly slots.
          nextHabit.weeklySlotsByDay = {};
          nextHabit.scheduleMode = "STANDARD";
        }
      }
      nextHabit.memo = typeof nextHabit.memo === "string" ? nextHabit.memo : "";

      // Ensure new fields always present
      if (!Array.isArray(nextHabit.expectedDays)) nextHabit.expectedDays = [];
      if (typeof nextHabit.anytimeFlexible !== "boolean") nextHabit.anytimeFlexible = false;
      if (!normalizePlanningMode(nextHabit.planningMode)) nextHabit.planningMode = "NO_TIME";
      if (!nextHabit.daySlotsByDay || typeof nextHabit.daySlotsByDay !== "object") nextHabit.daySlotsByDay = {};
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

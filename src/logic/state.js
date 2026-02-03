// src/logic/state.js
import { loadState, saveState } from "../utils/storage";
import { uid } from "../utils/helpers";
import { normalizeGoalsState } from "./goals";
import { normalizeReminder } from "./reminders";
import { normalizeLocalDateKey, toLocalDateKey } from "../utils/dateKey";
import { resolveGoalType, isOutcome, isProcess } from "../domain/goalType";
import { findOccurrenceForGoalDateDeterministic, setOccurrenceStatus, upsertOccurrence } from "./occurrences";
import { normalizeTimeFields } from "./timeFields";
import { BLOCKS_SCHEMA_VERSION, getDefaultBlocksByPage } from "./blocks/registry";
import { ensureBlocksConfig } from "./blocks/ensureBlocksConfig";
import { validateBlocksState } from "./blocks/validateBlocksState";
import { buildScheduleRuleSourceKey, buildScheduleRulesFromAction, normalizeScheduleRule } from "./scheduleRules";
import { isFinalOccurrenceStatus } from "./metrics";
import { BRAND_ACCENT } from "../theme/themeTokens";

export const THEME_PRESETS = ["aurora", "midnight", "sunset", "ocean", "forest"];
export const SYSTEM_INBOX_ID = "sys_inbox";
export const DEFAULT_CATEGORY_ID = SYSTEM_INBOX_ID;

export const DEFAULT_CATEGORIES = [
  { id: "cat_sport", name: "Sport", color: "#7C3AED", wallpaper: "", mainGoalId: null },
  { id: "cat_work", name: "Travail", color: "#06B6D4", wallpaper: "", mainGoalId: null },
  { id: "cat_health", name: "Santé", color: "#22C55E", wallpaper: "", mainGoalId: null },
];

export const DEFAULT_BLOCKS = [
  { id: "block_why", type: "WHY", enabled: true },
  { id: "block_habits", type: "HABITS", enabled: true },
  { id: "block_goal", type: "GOAL", enabled: true },
];

const SCHEMA_VERSION = 1;

const MEASURE_TYPES = new Set(["money", "counter", "time", "energy", "distance", "weight"]);
const TRACKING_MODES = new Set(["none", "manual", "template"]);
const REPEAT_VALUES = new Set(["none", "daily", "weekly"]);

const SCHEDULE_MODES = new Set(["STANDARD", "WEEKLY_SLOTS"]);

// V3+ (premium): lifecycle + completion rules for PROCESS goals
const LIFECYCLE_MODES = new Set(["FIXED", "ROLLING", "UNTIL_DONE"]);
const COMPLETION_MODES = new Set(["ONCE", "COUNT", "DURATION"]);
const MISS_POLICIES = new Set(["STRICT", "LENIENT"]);

function normalizeLifecycleMode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return LIFECYCLE_MODES.has(raw) ? raw : "";
}

function normalizeCompletionMode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return COMPLETION_MODES.has(raw) ? raw : "";
}

function normalizeMissPolicy(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return MISS_POLICIES.has(raw) ? raw : "";
}

function normalizeInt(value, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < min || v > max) return null;
  return v;
}

function normalizeFloat(value, { min = -Number.POSITIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function normalizeDateKeyLoose(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return normalizeLocalDateKey(raw) || "";
}

function addDaysDateKey(dateKey, days) {
  const k = normalizeDateKeyLoose(dateKey);
  if (!k) return "";
  const base = new Date(`${k}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + (Number.isFinite(days) ? Math.trunc(days) : 0));
  return toLocalDateKey(base);
}

function compareDateKeys(a, b) {
  const x = normalizeDateKeyLoose(a);
  const y = normalizeDateKeyLoose(b);
  if (!x || !y) return 0;
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

function normalizeScheduleMode(value) {
  if (!value || typeof value !== "string") return "";
  const x = value.trim().toUpperCase();
  return SCHEDULE_MODES.has(x) ? x : "";
}

function normalizeWeeklySlotsByDay(value) {
  if (!value || typeof value !== "object") return null;
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
      if (!start || !end) continue;
      clean.push({ start, end });
    }
    if (clean.length) out[day] = clean;
  }
  return Object.keys(out).length ? out : null;
}
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]);
const QUANTITY_PERIODS = new Set(["DAY", "WEEK", "MONTH"]);
const GOAL_PRIORITY_VALUES = new Set(["prioritaire", "secondaire", "bonus"]);

// Demo mode (disabled by default).
export const DEMO_MODE = false;

function isDemoMode() {
  if (DEMO_MODE) return true;
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "1";
  } catch (err) {
    void err;
    return false;
  }
}

// -----------------------------
// V2 (data-only): goal planning
// -----------------------------
// NOTE: no UI is wired to this yet. This is a safe schema extension.
// schedule: user planning defined at goal creation (not at "start")
// status: queued | active | done | invalid
// order: global execution order (lower = higher priority)
// resetPolicy: what happens on abandon

export function createDefaultGoalSchedule() {
  return {
    timezone: "Europe/Paris",

    // Weekly defaults (user will later edit in UI)
    // 1 = Monday ... 7 = Sunday
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    timeSlots: ["00:00"], // HH:mm

    // Session / reminders (data-only for now)
    durationMinutes: 60,
    remindBeforeMinutes: 10,
    allowSnooze: true,
    snoozeMinutes: 10,
    remindersEnabled: false,
  };
}

export function normalizeResetPolicy(raw) {
  // Accept string or legacy object shape { mode }
  const v = typeof raw === "string" ? raw : raw?.mode;
  if (v === "reset" || v === "invalidate") return v;
  return "invalidate";
}

function normalizeCadence(raw) {
  const v = typeof raw === "string" ? raw.toUpperCase() : "";
  if (v === "DAILY" || v === "WEEKLY" || v === "YEARLY") return v;
  return "";
}

function normalizeRepeat(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return REPEAT_VALUES.has(v) ? v : "";
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
  return QUANTITY_PERIODS.has(raw) ? raw : "DAY";
}

function normalizeGoalPriority(raw) {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  return GOAL_PRIORITY_VALUES.has(v) ? v : "";
}

function cadenceToFreqUnit(cadence) {
  if (cadence === "DAILY") return "DAY";
  if (cadence === "YEARLY") return "YEAR";
  return "WEEK";
}

function inferMeasureTypeFromUnit(unit) {
  const raw = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "€" || raw === "eur" || raw === "euro" || raw === "euros") return "money";
  if (raw === "kg" || raw === "kilo" || raw === "kilos") return "weight";
  if (raw === "km" || raw === "kilometre") return "distance";
  if (raw === "min" || raw === "minute" || raw === "minutes" || raw === "h" || raw === "heure" || raw === "heures")
    return "time";
  if (raw === "pas" || raw === "step" || raw === "steps" || raw === "rep" || raw === "reps") return "counter";
  if (raw === "pt" || raw === "pts" || raw === "point" || raw === "points") return "energy";
  if (raw === "%") return "counter";
  if (MEASURE_TYPES.has(raw)) return raw;
  return "";
}

function backfillGoalLegacyFields(rawGoal) {
  if (!rawGoal || typeof rawGoal !== "object") return rawGoal;
  const g = { ...rawGoal };
  const rawType = typeof g.type === "string" ? g.type.toUpperCase() : "";
  const rawPlan = typeof g.planType === "string" ? g.planType.toUpperCase() : "";
  const resolvedType = resolveGoalType(g);

  if (!rawType) {
    g.type = resolvedType;
  }

  if (!rawPlan) {
    if (resolvedType === "OUTCOME") g.planType = "STATE";
    else if (resolvedType === "PROCESS") g.planType = g.oneOffDate ? "ONE_OFF" : "ACTION";
  }

  if (!g.freqUnit || !Number.isFinite(g.freqCount)) {
    const cadence = normalizeCadence(g.cadence);
    if (!g.freqUnit && cadence) g.freqUnit = cadenceToFreqUnit(cadence);
    if (!Number.isFinite(g.freqCount)) {
      const rawTarget = typeof g.target === "string" ? Number(g.target) : g.target;
      const target = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.floor(rawTarget) : 1;
      g.freqCount = target;
    }
  }

  if (!g.startAt && typeof g.startDate === "string" && g.startDate.trim()) {
    g.startAt = `${g.startDate.trim()}T09:00`;
  }

  if (!g.parentId && typeof g.primaryGoalId === "string" && g.primaryGoalId.trim()) {
    g.parentId = g.primaryGoalId.trim();
  }
  if (!Number.isFinite(g.weight) && Number.isFinite(g.linkWeight)) {
    g.weight = g.linkWeight;
  }

  if (g.metric && typeof g.metric === "object") {
    if (!g.measureType) {
      const inferred = inferMeasureTypeFromUnit(g.metric.unit);
      if (inferred) g.measureType = inferred;
    }
    if (!Number.isFinite(g.targetValue) && Number.isFinite(g.metric.targetValue)) {
      g.targetValue = g.metric.targetValue;
    }
    if (!Number.isFinite(g.currentValue) && Number.isFinite(g.metric.currentValue)) {
      g.currentValue = g.metric.currentValue;
    }
  }

  if (!normalizeGoalPriority(g.priority)) {
    const level = typeof g.priorityLevel === "string" ? g.priorityLevel.toLowerCase() : "";
    if (level === "primary") g.priority = "prioritaire";
    else if (level === "secondary") g.priority = "secondaire";
    else {
      const tier = typeof g.priorityTier === "string" ? g.priorityTier.toLowerCase() : "";
      if (tier === "essential") g.priority = "prioritaire";
      else if (tier === "optional" || tier === "someday") g.priority = "bonus";
      else g.priority = "secondaire";
    }
  }

  return g;
}

function normalizeLegacyHabit(rawHabit, index = 0) {
  const h = rawHabit && typeof rawHabit === "object" ? { ...rawHabit } : {};
  if (!h.id) h.id = uid();
  if (typeof h.title !== "string" || !h.title.trim()) {
    if (typeof h.name === "string" && h.name.trim()) h.title = h.name.trim();
    else h.title = `Action ${index + 1}`;
  }
  if (typeof h.cadence !== "string") h.cadence = "WEEKLY";
  if (!Number.isFinite(h.target)) h.target = 1;
  if (typeof h.categoryId !== "string" || !h.categoryId.trim()) h.categoryId = DEFAULT_CATEGORY_ID;
  return h;
}

function migrateLegacyChecks(rawChecks) {
  const checks = rawChecks && typeof rawChecks === "object" ? rawChecks : {};
  const nextChecks = {};
  let legacyFound = false;

  for (const [key, bucket] of Object.entries(checks)) {
    const dateKey = normalizeLocalDateKey(key);
    if (dateKey) {
      const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter(Boolean) : [];
      const micro = bucket?.micro && typeof bucket.micro === "object"
        ? { ...bucket.micro }
        : Array.isArray(bucket?.micro)
          ? bucket.micro.reduce((acc, id) => {
              if (typeof id === "string" && id.trim()) acc[id] = true;
              return acc;
            }, {})
          : {};
      if (habits.length || Object.keys(micro).length) {
        nextChecks[dateKey] = { habits: Array.from(new Set(habits)), micro };
      }
      continue;
    }

    if (bucket && typeof bucket === "object" && (bucket.daily || bucket.weekly || bucket.yearly)) {
      legacyFound = true;
      const daily = bucket.daily && typeof bucket.daily === "object" ? bucket.daily : {};
      for (const [dKey, val] of Object.entries(daily)) {
        if (!val) continue;
        const normalized = normalizeLocalDateKey(dKey);
        if (!normalized) continue;
        const entry = nextChecks[normalized] || { habits: [], micro: {} };
        if (!entry.habits.includes(key)) entry.habits.push(key);
        nextChecks[normalized] = entry;
      }
    }
  }

  return legacyFound ? { checks: nextChecks, legacy: checks } : { checks, legacy: null };
}

function normalizeLegacyIdList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const id of list) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function extractStartTime(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const trimmed = raw.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

function normalizeLegacySession(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const dateKey = normalizeLocalDateKey(s.dateKey || s.date || "");
  const statusRaw = typeof s.status === "string" ? s.status.toLowerCase() : "";
  const status = statusRaw === "skipped" ? "skipped" : statusRaw === "done" || statusRaw === "partial" ? "done" : "";
  const habitIds = normalizeLegacyIdList(
    Array.isArray(s.habitIds) ? s.habitIds : s.habitId ? [s.habitId] : []
  );
  const doneHabitIds = normalizeLegacyIdList(
    Array.isArray(s.doneHabitIds) ? s.doneHabitIds : s.doneHabits ? s.doneHabits : []
  );
  const start = extractStartTime(s.startAt || s.startedAt || s.timerStartedAt || "");
  const durationMinutes = Number.isFinite(s.duration)
    ? Math.round(s.duration)
    : Number.isFinite(s.durationSec)
      ? Math.round(s.durationSec / 60)
      : null;
  return { dateKey, status, habitIds, doneHabitIds, start, durationMinutes };
}

function migrateLegacyActivity(nextState) {
  if (!nextState || typeof nextState !== "object") {
    return { state: nextState, checksLegacy: null, sessionsLegacy: null };
  }
  const goals = Array.isArray(nextState.goals) ? nextState.goals : [];
  const goalIds = new Set(goals.map((g) => g?.id).filter(Boolean));
  let occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
  const microChecks = nextState.microChecks && typeof nextState.microChecks === "object"
    ? { ...nextState.microChecks }
    : {};

  const applyStatus = (goalId, dateKey, status, start, durationMinutes) => {
    if (!goalId || !dateKey || !status) return;
    if (!goalIds.has(goalId)) return;
    const hasAny = occurrences.some((o) => o && o.goalId === goalId && o.date === dateKey);
    const preferredStart = typeof start === "string" ? start : "";

    if (preferredStart) {
      const match = findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, preferredStart);
      if (match && match.start === preferredStart) {
        occurrences = setOccurrenceStatus(goalId, dateKey, preferredStart, status, { occurrences, goals });
        return;
      }
      if (!hasAny) {
        occurrences = upsertOccurrence(
          goalId,
          dateKey,
          preferredStart,
          durationMinutes,
          { status },
          { occurrences, goals }
        );
        return;
      }
      if (match) {
        const fallbackStart = match.start || "00:00";
        occurrences = setOccurrenceStatus(goalId, dateKey, fallbackStart, status, { occurrences, goals });
        return;
      }
      occurrences = upsertOccurrence(
        goalId,
        dateKey,
        preferredStart,
        durationMinutes,
        { status },
        { occurrences, goals }
      );
      return;
    }

    if (hasAny) {
      const match = findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, "");
      if (match) {
        const fallbackStart = match.start || "00:00";
        occurrences = setOccurrenceStatus(goalId, dateKey, fallbackStart, status, { occurrences, goals });
        return;
      }
    }

    occurrences = upsertOccurrence(
      goalId,
      dateKey,
      "00:00",
      durationMinutes,
      { status },
      { occurrences, goals }
    );
  };

  const migratedChecks = migrateLegacyChecks(nextState.checks);
  const normalizedChecks = migratedChecks.checks || {};
  for (const [key, bucket] of Object.entries(normalizedChecks)) {
    const dateKey = normalizeLocalDateKey(key);
    if (!dateKey) continue;
    const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
    for (const habitId of habits) {
      if (typeof habitId !== "string" || !habitId.trim()) continue;
      applyStatus(habitId.trim(), dateKey, "done", "", null);
    }
    const micro = bucket?.micro && typeof bucket.micro === "object" ? { ...bucket.micro } : {};
    if (Object.keys(micro).length) {
      microChecks[dateKey] = { ...(microChecks[dateKey] || {}), ...micro };
    }
  }

  const sessions = Array.isArray(nextState.sessions) ? nextState.sessions : [];
  for (const raw of sessions) {
    const normalized = normalizeLegacySession(raw);
    if (!normalized.dateKey || !normalized.status) continue;
    const targets =
      normalized.status === "skipped"
        ? normalized.habitIds
        : normalized.doneHabitIds.length
          ? normalized.doneHabitIds
          : normalized.habitIds;
    for (const habitId of targets) {
      applyStatus(habitId, normalized.dateKey, normalized.status, normalized.start, normalized.durationMinutes);
    }
  }

  return {
    state: { ...nextState, occurrences, microChecks },
    checksLegacy: migratedChecks.legacy,
    sessionsLegacy: sessions.length ? sessions : null,
  };
}

function mergeLegacyHabitsIntoGoals(state) {
  if (!state || typeof state !== "object") return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const habits = Array.isArray(state.habits) ? state.habits : [];
  if (!habits.length) return state;

  const existingGoalIds = new Set(goals.map((g) => g?.id).filter(Boolean));
  const existingProcessIds = new Set(
    goals.filter((g) => resolveGoalType(g) === "PROCESS").map((g) => g?.id).filter(Boolean)
  );

  const categories = Array.isArray(state.categories) ? state.categories : [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const goalsById = new Map(goals.map((g) => [g.id, g]));

  const additions = [];
  for (const habit of habits) {
    if (!habit || !habit.id) continue;
    if (existingProcessIds.has(habit.id)) continue;
    if (existingGoalIds.has(habit.id)) continue;

    const cadence = normalizeCadence(habit.cadence);
    const freqUnit = cadence ? cadenceToFreqUnit(cadence) : "WEEK";
    const rawTarget = typeof habit.target === "string" ? Number(habit.target) : habit.target;
    const freqCount = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.floor(rawTarget) : 1;
    const categoryId = typeof habit.categoryId === "string" ? habit.categoryId : "";
    const category = categoryId ? categoryById.get(categoryId) : null;

    let parentId = null;
    if (typeof habit.parentId === "string" && habit.parentId.trim()) parentId = habit.parentId.trim();
    if (!parentId && typeof habit.primaryGoalId === "string" && habit.primaryGoalId.trim()) {
      parentId = habit.primaryGoalId.trim();
    }
    if (!parentId && category?.mainGoalId) parentId = category.mainGoalId;
    if (parentId && goalsById.has(parentId)) {
      const parent = goalsById.get(parentId);
      if (!isOutcome(parent) || parent?.categoryId !== categoryId) parentId = null;
    }

    additions.push({
      id: habit.id,
      categoryId,
      title: habit.title || "Action",
      type: "PROCESS",
      planType: "ACTION",
      kind: "ACTION",
      cadence: cadence || "WEEKLY",
      target: freqCount,
      freqUnit,
      freqCount,
      parentId,
      primaryGoalId: parentId,
    });
  }

  if (!additions.length) return state;
  return { ...state, goals: [...goals, ...additions] };
}

export function normalizeCategory(rawCat, index = 0) {
  const c = rawCat && typeof rawCat === "object" ? { ...rawCat } : {};
  if (!c.id) c.id = uid();
  if (c.id === SYSTEM_INBOX_ID) {
    c.name = "Général";
    c.system = true;
  }
  if (typeof c.name !== "string" || !c.name.trim()) c.name = `Catégorie ${index + 1}`;
  if (typeof c.color !== "string" || !c.color.trim()) c.color = "#7C3AED";
  if (typeof c.wallpaper !== "string") c.wallpaper = "";
  if (typeof c.whyText !== "string") c.whyText = "";
  if (typeof c.templateId !== "string" || !c.templateId.trim()) c.templateId = null;
  c.mainGoalId = typeof c.mainGoalId === "string" && c.mainGoalId.trim() ? c.mainGoalId : null;
  c.system = Boolean(c.system);
  if (typeof c.createdAt !== "string") c.createdAt = "";
  return c;
}

export function ensureSystemInboxCategory(state) {
  const next = state && typeof state === "object" ? { ...state } : {};
  const categories = Array.isArray(next.categories) ? next.categories : [];
  const existing =
    categories.find((cat) => cat && (cat.id === SYSTEM_INBOX_ID || cat.system)) || null;
  if (existing) return { state: { ...next, categories }, category: existing };
  const createdAt = new Date().toISOString();
  const inbox = normalizeCategory(
    {
      id: SYSTEM_INBOX_ID,
      name: "Général",
      color: "#64748B",
      system: true,
      createdAt,
    },
    categories.length
  );
  return { state: { ...next, categories: [...categories, inbox] }, category: inbox };
}

export function normalizeGoal(rawGoal, index = 0) {
  const g = rawGoal && typeof rawGoal === "object" ? { ...rawGoal } : {};

  if (!g.id) g.id = uid();
  const rawCategoryId = typeof g.categoryId === "string" ? g.categoryId.trim() : "";
  g.categoryId = rawCategoryId || null;

  const goalType = resolveGoalType(g);
  const outcome = goalType === "OUTCOME";
  const process = goalType === "PROCESS";
  const inferredPlanType = g.oneOffDate ? "ONE_OFF" : "ACTION";

  if (!g.categoryId) g.categoryId = DEFAULT_CATEGORY_ID;

  const rawOutcomeId = typeof g.outcomeId === "string" ? g.outcomeId.trim() : "";
  const rawObjectiveId = typeof g.objectiveId === "string" ? g.objectiveId.trim() : "";
  const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
  g.parentId = rawParent || rawOutcomeId || rawObjectiveId || null;
  g.outcomeId = g.parentId || null;
  if (typeof g.objectiveId === "string") g.objectiveId = null;

  // Canonical semantics:
  // - OUTCOME = objective (STATE) : can carry metric/deadline/notes, but never scheduling/frequency/session/parent.
  // - PROCESS = habit (ACTION or ONE_OFF) : can carry frequency/session/oneOffDate, but never metric/deadline/notes.
  if (!g.type && outcome) g.type = "OUTCOME";
  if (!g.type && process) g.type = "PROCESS";
  if (!g.planType && outcome) g.planType = "STATE";
  if (!g.planType && process) g.planType = inferredPlanType;
  if (!g.kind && outcome) g.kind = "OUTCOME";
  if (!g.kind && process) g.kind = "ACTION";

  if (!g.title) g.title = "Objectif";
  if (!outcome) {
    if (!g.cadence) g.cadence = "WEEKLY";
    if (typeof g.target !== "number") g.target = 1;
  }

  if (typeof g.templateId !== "string") g.templateId = null;
  if (outcome) g.templateType = "GOAL";
  else if (process) g.templateType = "HABIT";
  else if (typeof g.templateType !== "string") g.templateType = null;

  // Optional: deadline as ISO date (YYYY-MM-DD). Empty string means "no deadline yet".
  if (typeof g.deadline !== "string") g.deadline = "";
  if (typeof g.notes !== "string") g.notes = "";
  const rawStartDate = typeof g.startDate === "string" ? g.startDate.trim() : "";
  g.startDate = normalizeLocalDateKey(rawStartDate) || "";

  // V3: lifecycle (period) + optional location context
  // NOTE: For PROCESS goals, a period is mandatory (activeFrom/activeTo).
  // For OUTCOME goals, lifecycle is ignored.
  g.lifecycleMode = normalizeLifecycleMode(g.lifecycleMode) || "";
  g.activeFrom = normalizeDateKeyLoose(g.activeFrom) || "";
  g.activeTo = normalizeDateKeyLoose(g.activeTo) || "";

  // Optional location (premium context)
  if (typeof g.locationLabel !== "string") g.locationLabel = "";
  if (typeof g.locationAddress !== "string") g.locationAddress = "";
  g.locationLat = normalizeFloat(g.locationLat, { min: -90, max: 90 });
  g.locationLng = normalizeFloat(g.locationLng, { min: -180, max: 180 });
  g.locationRadiusMeters = normalizeInt(g.locationRadiusMeters, { min: 10, max: 20000 });

  const rawTracking = typeof g.trackingMode === "string" ? g.trackingMode.trim() : "";
  if (outcome) g.trackingMode = TRACKING_MODES.has(rawTracking) ? rawTracking : "none";
  if (process) g.trackingMode = "none";

  // Optional: measurement fields for OUTCOME goals.
  const rawMeasure = typeof g.measureType === "string" ? g.measureType.trim() : "";
  g.measureType = MEASURE_TYPES.has(rawMeasure) ? rawMeasure : null;
  const rawTarget = typeof g.targetValue === "string" ? Number(g.targetValue) : g.targetValue;
  const rawCurrent = typeof g.currentValue === "string" ? Number(g.currentValue) : g.currentValue;
  g.targetValue = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
  g.currentValue = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : null;
  if (!g.targetValue) g.currentValue = null;

  if (typeof g.habitNotes !== "string") g.habitNotes = "";
  const quantityValue = normalizeQuantityValue(g.quantityValue);
  const quantityUnit = normalizeQuantityUnit(g.quantityUnit);
  const quantityPeriod = normalizeQuantityPeriod(g.quantityPeriod);
  if (quantityValue && quantityUnit) {
    g.quantityValue = quantityValue;
    g.quantityUnit = quantityUnit;
    g.quantityPeriod = quantityPeriod;
  } else {
    g.quantityValue = null;
    g.quantityUnit = "";
    g.quantityPeriod = "";
  }
  g.reminderTime = normalizeStartTime(g.reminderTime);
  g.reminderWindowStart = normalizeStartTime(g.reminderWindowStart);
  g.reminderWindowEnd = normalizeStartTime(g.reminderWindowEnd);

  // Strict separation:
  // OUTCOME (objective): keep metric/deadline/notes, but remove any habit/scheduling fields.
  // PROCESS (habit): keep planning/frequency fields, but remove any outcome fields.
  if (outcome) {
    // Remove habit fields
    g.cadence = undefined;
    g.target = undefined;
    g.freqUnit = undefined;
    g.freqCount = undefined;
    g.sessionMinutes = null;
    g.oneOffDate = undefined;
    g.habitNotes = "";
    g.quantityValue = null;
    g.quantityUnit = "";
    g.quantityPeriod = "";
    g.reminderTime = "";
    g.reminderWindowStart = "";
    g.reminderWindowEnd = "";

    // Remove scheduling remnants
    g.startAt = null;
    g.endAt = null;

    // Remove lifecycle + location (OUTCOME does not carry execution lifecycle)
    g.lifecycleMode = "";
    g.activeFrom = "";
    g.activeTo = "";
    g.locationLabel = "";
    g.locationAddress = "";
    g.locationLat = null;
    g.locationLng = null;
    g.locationRadiusMeters = null;

    // Remove advanced process scheduling fields (must never live on OUTCOME)
    g.scheduleMode = undefined;
    g.weeklySlotsByDay = undefined;
    if (g.schedule && typeof g.schedule === "object") {
      const sched = { ...g.schedule };
      delete sched.scheduleMode;
      delete sched.weeklySlotsByDay;
      g.schedule = sched;
    }

    // Outcome is the parent, never a child
    g.parentId = null;
    g.primaryGoalId = null;
    g.weight = 0;
    g.linkWeight = 0;
    g.outcomeId = null;

    if (!g.measureType) {
      g.targetValue = null;
      g.currentValue = null;
    }
  }

  if (process) {
    // Remove outcome fields
    g.deadline = "";
    g.metric = null;
    g.notes = "";
    g.measureType = null;
    g.targetValue = null;
    g.currentValue = null;

    // PROCESS lifecycle: mandatory period.
    // Rules:
    // - ONE_OFF: activeFrom = oneOffDate, activeTo = oneOffDate
    // - ACTION (recurring/anytime): default period = 30 days starting today if missing
    // - If activeTo < activeFrom, clamp activeTo to activeFrom
    const todayKey = toLocalDateKey();
    const existingFrom = g.activeFrom || "";
    const existingTo = g.activeTo || "";

    // Default lifecycleMode
    if (!g.lifecycleMode) g.lifecycleMode = "FIXED";

    if (g.planType === "ONE_OFF") {
      const oneOff = normalizeDateKeyLoose(g.oneOffDate);
      g.activeFrom = oneOff || existingFrom || todayKey;
      g.activeTo = g.activeFrom;
      g.lifecycleMode = "FIXED";
    } else {
      g.activeFrom = existingFrom || todayKey;
      // Default fixed window: 30 days (inclusive) => +29 days
      g.activeTo = existingTo || addDaysDateKey(g.activeFrom, 29);
      if (compareDateKeys(g.activeTo, g.activeFrom) < 0) g.activeTo = g.activeFrom;
      if (!normalizeLifecycleMode(g.lifecycleMode)) g.lifecycleMode = "FIXED";
    }

    // Ensure planType coherence
    if (g.planType === "ONE_OFF") {
      // oneOffDate is the only date carrier for ONE_OFF habits
      if (typeof g.oneOffDate !== "string" || !g.oneOffDate.trim()) {
        // allow legacy fallback if any
        const legacy = typeof rawGoal?.deadline === "string" ? rawGoal.deadline.trim() : "";
        g.oneOffDate = legacy || "";
      }
      g.cadence = undefined;
      g.target = undefined;
      g.freqUnit = undefined;
      g.freqCount = undefined;
      g.sessionMinutes = null;
    } else {
      // ACTION habit must not carry oneOffDate
      g.oneOffDate = undefined;
    }

    g.outcomeId = g.parentId || null;

    // Completion rules (V3): default ONCE.
    g.completionMode = normalizeCompletionMode(g.completionMode) || "ONCE";
    g.completionTarget = normalizeFloat(g.completionTarget, { min: 1, max: 1000000 });
    g.missPolicy = normalizeMissPolicy(g.missPolicy) || "LENIENT";
    g.graceMinutes = normalizeInt(g.graceMinutes, { min: 0, max: 24 * 60 });

    // Backfill from legacy quantity fields when present (non-breaking)
    if (g.completionMode === "ONCE") {
      const qv = normalizeFloat(g.quantityValue, { min: 1, max: 1000000 });
      if (qv && (typeof g.quantityUnit === "string" && g.quantityUnit.trim())) {
        g.completionMode = "COUNT";
        g.completionTarget = qv;
      }
    }

    // completionTarget required for COUNT/DURATION
    if ((g.completionMode === "COUNT" || g.completionMode === "DURATION") && !g.completionTarget) {
      g.completionTarget = g.completionMode === "DURATION" ? (normalizeFloat(g.durationMinutes, { min: 1, max: 24 * 60 }) || 30) : 1;
    }

    // If ONCE, ignore completionTarget
    if (g.completionMode === "ONCE") g.completionTarget = null;
  }

  // If a PROCESS has no valid parentId, keep it null (linking is optional)
  if (process) {
    const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
    g.parentId = rawParent ? rawParent : null;
    if (typeof g.primaryGoalId === "string") {
      const rawPrimary = g.primaryGoalId.trim();
      g.primaryGoalId = rawPrimary ? rawPrimary : null;
    }
    if (!g.parentId) g.weight = Number.isFinite(g.weight) ? g.weight : 100;
  }

  // Optional: link strength to main WHY (0..1). Used by priorities engine when available.
  if (typeof g.whyLink !== "number") g.whyLink = 0;

  // Optional: user-estimated value/impact (0..10). Used as tie-breaker when available.
  if (typeof g.impact !== "number") g.impact = 0;

  // V2 fields
  // status: queued | active | done | invalid
  if (!g.status) g.status = "queued";
  if (typeof g.order !== "number") g.order = index + 1;
    // Scheduling rules:
  // - PROCESS/ACTION: schedule is canonical and can later drive occurrences/reminders.
  // - OUTCOME/STATE: schedule is OPTIONAL and is only used for planning visibility (calendar coloring),
  //   reminders must stay disabled for OUTCOME.
  const shouldHaveProcessSchedule = process && g.planType === "ACTION";
  const shouldKeepOutcomeSchedule = outcome && g.planType === "STATE" && g.schedule && typeof g.schedule === "object";

  if (shouldHaveProcessSchedule || shouldKeepOutcomeSchedule) {
    const base = createDefaultGoalSchedule();
    if (!g.schedule || typeof g.schedule !== "object") {
      g.schedule = { ...base };
    } else {
      g.schedule = { ...base, ...g.schedule };
    }

    if (!Array.isArray(g.schedule.daysOfWeek)) g.schedule.daysOfWeek = base.daysOfWeek;
    if (!Array.isArray(g.schedule.timeSlots)) g.schedule.timeSlots = base.timeSlots;
    if (typeof g.schedule.timezone !== "string") g.schedule.timezone = base.timezone;

    if (typeof g.schedule.durationMinutes !== "number") g.schedule.durationMinutes = base.durationMinutes;
    if (typeof g.schedule.remindBeforeMinutes !== "number") g.schedule.remindBeforeMinutes = base.remindBeforeMinutes;
    if (typeof g.schedule.allowSnooze !== "boolean") g.schedule.allowSnooze = base.allowSnooze;
    if (typeof g.schedule.snoozeMinutes !== "number") g.schedule.snoozeMinutes = base.snoozeMinutes;
    if (typeof g.schedule.remindersEnabled !== "boolean") g.schedule.remindersEnabled = base.remindersEnabled;

    // Hard rule: OUTCOME goals never emit reminders.
    if (outcome) {
      g.schedule.remindersEnabled = false;
      // NOTE: OUTCOME may keep schedule for planning visibility, but reminders are always forced OFF here.
    }
  } else {
    g.schedule = undefined;
  }

  if (process) {
    const scheduleDays = normalizeDaysOfWeek(g.schedule?.daysOfWeek);
    let repeat = normalizeRepeat(g.repeat);
    if (!repeat) {
      if (g.planType === "ONE_OFF" || normalizeLocalDateKey(g.oneOffDate)) {
        repeat = "none";
      } else if (scheduleDays.length && scheduleDays.length < 7) {
        repeat = "weekly";
      } else {
        repeat = "daily";
      }
    }
    g.repeat = repeat || "none";

    const days = normalizeDaysOfWeek(g.daysOfWeek);
    if (g.repeat === "weekly") {
      g.daysOfWeek = days.length ? days : scheduleDays;
    } else {
      g.daysOfWeek = days.length ? days : [];
    }

    const reminderTime = normalizeStartTime(g.reminderTime);
    const scheduleSlots = Array.isArray(g.schedule?.timeSlots) ? g.schedule.timeSlots : [];
    const scheduleSlot0 = normalizeStartTime(scheduleSlots[0]);
    const startTimeRaw = normalizeStartTime(g.startTime);
    const isLegacyDefaultSlot = scheduleSlots.length === 1 && scheduleSlot0 === "09:00";
    const isAnytime = !startTimeRaw && !reminderTime;
    if (isAnytime && isLegacyDefaultSlot) {
      if (g.schedule && typeof g.schedule === "object") {
        g.schedule.timeSlots = ["00:00"];
      }
      g.startTime = "";
    }

    const startTime = normalizeStartTime(g.startTime);
    const scheduleStart = normalizeStartTime(g.schedule?.timeSlots?.[0]);
    if (startTime) g.startTime = startTime;
    else if (scheduleStart && scheduleStart !== "00:00") g.startTime = scheduleStart;
    else g.startTime = "";

    const timeFields = normalizeTimeFields({
      timeMode: g.timeMode,
      timeSlots: g.timeSlots,
      startTime: g.startTime,
      reminderTime,
    });
    g.timeMode = timeFields.timeMode;
    g.timeSlots = timeFields.timeSlots;
    g.startTime = timeFields.startTime;

    // Advanced scheduling (weekly slots by day)
    let scheduleMode = normalizeScheduleMode(g.scheduleMode) || normalizeScheduleMode(g.schedule?.scheduleMode);
    const weeklySlotsByDay = normalizeWeeklySlotsByDay(g.weeklySlotsByDay) || normalizeWeeklySlotsByDay(g.schedule?.weeklySlotsByDay);

    if (weeklySlotsByDay && !scheduleMode) scheduleMode = "WEEKLY_SLOTS";

    if (scheduleMode === "WEEKLY_SLOTS" && weeklySlotsByDay) {
      g.scheduleMode = "WEEKLY_SLOTS";
      g.weeklySlotsByDay = weeklySlotsByDay;
      if (g.schedule && typeof g.schedule === "object") {
        g.schedule = { ...g.schedule, scheduleMode: "WEEKLY_SLOTS", weeklySlotsByDay };
      }
    } else {
      // Any non-weekly-slots mode: clear payload to avoid stale data.
      if (typeof g.scheduleMode !== "undefined") g.scheduleMode = undefined;
      if (typeof g.weeklySlotsByDay !== "undefined") g.weeklySlotsByDay = undefined;
      if (g.schedule && typeof g.schedule === "object") {
        const sched = { ...g.schedule };
        delete sched.scheduleMode;
        delete sched.weeklySlotsByDay;
        g.schedule = sched;
      }
    }

    // ONE_OFF must never carry weekly-slots payload.
    if (g.planType === "ONE_OFF") {
      g.scheduleMode = undefined;
      g.weeklySlotsByDay = undefined;
      if (g.schedule && typeof g.schedule === "object") {
        const sched = { ...g.schedule };
        delete sched.scheduleMode;
        delete sched.weeklySlotsByDay;
        g.schedule = sched;
      }
    }

    const duration = normalizeDurationMinutes(g.durationMinutes);
    const scheduleDuration = normalizeDurationMinutes(g.schedule?.durationMinutes);
    const sessionDuration = normalizeDurationMinutes(g.sessionMinutes);
    g.durationMinutes = duration ?? scheduleDuration ?? sessionDuration ?? null;
  }

  // OUTCOME goals must not carry completion/miss semantics.
  if (outcome) {
    g.completionMode = undefined;
    g.completionTarget = undefined;
    g.missPolicy = undefined;
    g.graceMinutes = undefined;
  }
  g.resetPolicy = normalizeResetPolicy(g.resetPolicy);

  return g;
}

export { normalizeGoal as normalizeGoalFields };

export function initialData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: "",
      lastName: "",
      whyText: "",
      whyImage: "",
      whyUpdatedAt: "",
      plan: "free",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocksSchemaVersion: BLOCKS_SCHEMA_VERSION,
      blocksByPage: getDefaultBlocksByPage(),
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: null,

      // V3: per-view focus (used to decouple Today/Library/Plan later)
      selectedCategoryByView: {
        home: null,
        library: null,
        plan: null,
        pilotage: null,
      },

      // V2: per-page theming
      pageThemes: { home: "aurora" },
      pageAccents: { home: BRAND_ACCENT },

      // legacy (kept for backward compatibility during migration)
      pageThemeHome: "aurora",
      accentHome: BRAND_ACCENT,

      // V2: one active goal at a time
      activeGoalId: null,
      mainGoalId: null,
      selectedGoalByCategory: {},
      categoryRailOrder: [],
      onboardingCompleted: false,
      onboardingSeenVersion: 0,
      onboardingStep: 1,
      tutorialEnabled: false,
      tutorialStep: null,
      tourSeenVersion: 0,
      tourStepIndex: 0,
      tourForceStart: false,
      permissions: {
        notifications: "unknown",
        calendar: "unknown",
        health: "unknown",
      },
      isDragging: false,
      creationFlowVersion: "v2",
      createDraft: null,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: toLocalDateKey(),
      selectedHabits: {},
      sessionDraft: null,
      activeSession: null,
    },
    categories: [],
    goals: [],
    habits: [],
    reminders: [],
    scheduleRules: [],
    sessionHistory: [],
    sessions: [],
    occurrences: [],
    checks: {},
    microChecks: {},
  };
}

export function demoData() {
  const categories = [
    { id: "demo_cat_1", name: "Catégorie 1", color: "#7C3AED", wallpaper: "", mainGoalId: null },
    { id: "demo_cat_2", name: "Catégorie 2", color: "#06B6D4", wallpaper: "", mainGoalId: null },
    { id: "demo_cat_3", name: "Catégorie 3", color: "#22C55E", wallpaper: "", mainGoalId: null },
  ];
  const outcomeId = uid();
  const processId = uid();

  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: "Démo",
      lastName: "",
      whyText: "Exemple de pourquoi (démo).",
      whyImage: "",
      whyUpdatedAt: "",
      plan: "free",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocksSchemaVersion: BLOCKS_SCHEMA_VERSION,
      blocksByPage: getDefaultBlocksByPage(),
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: categories[0].id,

      selectedCategoryByView: {
        home: categories[0].id,
        library: categories[0].id,
        plan: categories[0].id,
        pilotage: categories[0].id,
      },

      pageThemes: { home: "aurora" },
      pageAccents: { home: BRAND_ACCENT },
      pageThemeHome: "aurora",
      accentHome: BRAND_ACCENT,
      activeGoalId: null,
      mainGoalId: outcomeId,
      selectedGoalByCategory: {},
      categoryRailOrder: [],
      onboardingCompleted: true,
      onboardingSeenVersion: 2,
      onboardingStep: 3,
      tutorialEnabled: false,
      tutorialStep: null,
      tourSeenVersion: 0,
      tourStepIndex: 0,
      tourForceStart: false,
      permissions: {
        notifications: "unknown",
        calendar: "unknown",
        health: "unknown",
      },
      isDragging: false,
      creationFlowVersion: "v2",
      createDraft: null,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: toLocalDateKey(),
      selectedHabits: {},
      sessionDraft: null,
      activeSession: null,
    },
    categories: categories.map((c, idx) => ({ ...c, mainGoalId: idx === 0 ? outcomeId : c.mainGoalId })),
    goals: [
      {
        id: outcomeId,
        categoryId: categories[0].id,
        title: "Résultat démo",
        type: "OUTCOME",
        planType: "STATE",
        status: "active",
        deadline: "",
      },
      {
        id: processId,
        categoryId: categories[1].id,
        title: "Processus démo",
        type: "PROCESS",
        planType: "ACTION",
        status: "queued",
        cadence: "WEEKLY",
        target: 3,
        freqCount: 3,
        freqUnit: "WEEK",
        sessionMinutes: 30,
        parentId: outcomeId,
        weight: 100,
      },
    ],
    habits: [
      { id: uid(), categoryId: categories[0].id, title: "Action 1", cadence: "WEEKLY", target: 2 },
      { id: uid(), categoryId: categories[1].id, title: "Action 2", cadence: "DAILY", target: 1 },
    ],
    reminders: [],
    scheduleRules: [],
    sessionHistory: [],
    sessions: [],
    checks: {},
    microChecks: {},
  };
}

export function migrate(prev) {
  let next = prev && typeof prev === "object" ? { ...prev } : initialData();
  const prevSchemaVersion = Number.isFinite(next.schemaVersion) ? next.schemaVersion : 0;
  if (!Number.isFinite(next.schemaVersion)) next.schemaVersion = 0;

  // profile
  if (!next.profile) next.profile = {};
  if (typeof next.profile.lastName !== "string") next.profile.lastName = "";
  if (typeof next.profile.xp !== "number") next.profile.xp = 0;
  if (typeof next.profile.level !== "number") next.profile.level = 1;
  if (!next.profile.rewardClaims || typeof next.profile.rewardClaims !== "object") next.profile.rewardClaims = {};
  if (typeof next.profile.whyUpdatedAt !== "string") next.profile.whyUpdatedAt = "";
  if (typeof next.profile.plan !== "string") next.profile.plan = "free";

  // ui
  if (!next.ui) next.ui = {};
  if (!Array.isArray(next.ui.blocks) || next.ui.blocks.length === 0)
    next.ui.blocks = DEFAULT_BLOCKS.map((b) => ({ ...b }));
  if (typeof next.ui.blocksSchemaVersion !== "number") next.ui.blocksSchemaVersion = BLOCKS_SCHEMA_VERSION;
  if (!next.ui.blocksByPage || typeof next.ui.blocksByPage !== "object") {
    const seeded = { ...getDefaultBlocksByPage() };
    // Keep a legacy snapshot to avoid losing old configs (even if not used anymore).
    if (Array.isArray(next.ui.blocks)) seeded.legacy = next.ui.blocks.map((b) => ({ ...b }));
    next.ui.blocksByPage = ensureBlocksConfig(seeded);
  } else {
    next.ui.blocksByPage = ensureBlocksConfig(next.ui.blocksByPage);
  }
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  if (isDev) {
    const audit = validateBlocksState(next);
    if (!audit.ok) {
      // eslint-disable-next-line no-console
      console.warn("[blocks] invalid blocksByPage", audit.issues);
    }
  }
  if (!next.ui.selectedCategoryId) {
    next.ui.selectedCategoryId = null;
  }

  // V2: ensure pageThemes/pageAccents exist (used by utils/_theme)
  if (!next.ui.pageThemes || typeof next.ui.pageThemes !== "object") next.ui.pageThemes = {};
  if (!next.ui.pageAccents || typeof next.ui.pageAccents !== "object") next.ui.pageAccents = {};

  // migrate legacy single-value keys into the V2 objects
  if (!next.ui.pageThemes.home) {
    if (next.ui.pageThemeHome) next.ui.pageThemes.home = next.ui.pageThemeHome;
    else next.ui.pageThemes.home = "aurora";
  }
  if (!next.ui.pageAccents.home || next.ui.pageAccents.home !== BRAND_ACCENT) {
    next.ui.pageAccents.home = BRAND_ACCENT;
  }

  // legacy defaults (kept so old code paths don't crash)
  if (!next.ui.pageThemeHome) next.ui.pageThemeHome = next.ui.pageThemes?.home || "aurora";
  if (!next.ui.accentHome || next.ui.accentHome !== BRAND_ACCENT) {
    next.ui.accentHome = BRAND_ACCENT;
  }

  if (typeof next.ui.activeGoalId === "undefined") next.ui.activeGoalId = null;
  if (typeof next.ui.mainGoalId === "undefined") next.ui.mainGoalId = null;
  if (!next.ui.selectedGoalByCategory || typeof next.ui.selectedGoalByCategory !== "object") {
    next.ui.selectedGoalByCategory = {};
  }
  if (!Array.isArray(next.ui.categoryRailOrder)) next.ui.categoryRailOrder = [];

  // V3: per-view selected category (decouple Today/Library/Plan)
  if (!next.ui.selectedCategoryByView || typeof next.ui.selectedCategoryByView !== "object") {
    next.ui.selectedCategoryByView = { home: null, library: null, plan: null, pilotage: null };
  } else {
    if (typeof next.ui.selectedCategoryByView.home === "undefined") next.ui.selectedCategoryByView.home = null;
    if (typeof next.ui.selectedCategoryByView.library === "undefined") next.ui.selectedCategoryByView.library = null;
    if (typeof next.ui.selectedCategoryByView.plan === "undefined") next.ui.selectedCategoryByView.plan = null;
    if (typeof next.ui.selectedCategoryByView.pilotage === "undefined") next.ui.selectedCategoryByView.pilotage = null;
  }

  // Backfill per-view focus from legacy selectedCategoryId (one-time initialization)
  // Goal: views can diverge later without being coupled via selectedCategoryId.
  if (!next.ui.selectedCategoryByView.home) {
    next.ui.selectedCategoryByView.home = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.library) {
    next.ui.selectedCategoryByView.library = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.plan) {
    next.ui.selectedCategoryByView.plan = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.pilotage) {
    next.ui.selectedCategoryByView.pilotage = next.ui.selectedCategoryId || null;
  }

  if (typeof next.ui.soundEnabled === "undefined") next.ui.soundEnabled = false;
  if (typeof next.ui.onboardingCompleted === "undefined") next.ui.onboardingCompleted = false;
  if (typeof next.ui.onboardingSeenVersion !== "number") next.ui.onboardingSeenVersion = 0;
  if (typeof next.ui.onboardingStep === "undefined") next.ui.onboardingStep = 1;
  if (typeof next.ui.tutorialEnabled === "undefined") next.ui.tutorialEnabled = false;
  if (typeof next.ui.tutorialStep === "undefined") next.ui.tutorialStep = null;
  if (typeof next.ui.tourSeenVersion !== "number") next.ui.tourSeenVersion = 0;
  if (typeof next.ui.tourStepIndex !== "number") next.ui.tourStepIndex = 0;
  if (typeof next.ui.tourForceStart !== "boolean") next.ui.tourForceStart = false;
  if (typeof next.ui.isDragging !== "boolean") next.ui.isDragging = false;
  if (!next.ui.permissions || typeof next.ui.permissions !== "object") next.ui.permissions = {};
  if (typeof next.ui.permissions.notifications !== "string") next.ui.permissions.notifications = "unknown";
  if (typeof next.ui.permissions.calendar !== "string") next.ui.permissions.calendar = "unknown";
  if (typeof next.ui.permissions.health !== "string") next.ui.permissions.health = "unknown";
  if (next.ui.creationFlowVersion !== "legacy" && next.ui.creationFlowVersion !== "v2") {
    next.ui.creationFlowVersion = "legacy";
  }
  if (typeof next.ui.createDraft === "undefined") next.ui.createDraft = null;
  if (next.ui.createDraft && typeof next.ui.createDraft !== "object") next.ui.createDraft = null;
  if (typeof next.ui.showPlanStep === "undefined") next.ui.showPlanStep = false;
  if (!next.ui.selectedHabits || typeof next.ui.selectedHabits !== "object") next.ui.selectedHabits = {};
  if (typeof next.ui.sessionDraft === "undefined") next.ui.sessionDraft = null;
  if (typeof next.ui.activeSession === "undefined") next.ui.activeSession = null;
  {
    const raw = typeof next.ui.selectedDate === "string" ? next.ui.selectedDate : "";
    const parsed = raw ? new Date(`${raw}T12:00:00`) : null;
    const normalized = parsed && !Number.isNaN(parsed.getTime()) ? toLocalDateKey(parsed) : toLocalDateKey();
    next.ui.selectedDate = normalized;
  }

  // categories
  if (!Array.isArray(next.categories)) next.categories = [];
  next.categories = next.categories.map((cat, i) => normalizeCategory(cat, i));
  {
    const ensured = ensureSystemInboxCategory(next);
    next = ensured.state || next;
  }

  // Ensure selectedCategoryId always points to an existing category (or null)
  // NOTE: This legacy field is only kept for backward compatibility and should NOT drive per-view selection anymore.
  if (next.ui?.selectedCategoryId) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryId);
    if (!exists) next.ui.selectedCategoryId = next.categories[0]?.id || null;
  }

  // Ensure per-view home selection is valid as well
  if (next.ui?.selectedCategoryByView?.home) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.home);
    if (!exists) next.ui.selectedCategoryByView.home = next.categories[0]?.id || null;
  }

  // Ensure per-view library selection is valid
  if (next.ui?.selectedCategoryByView?.library) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.library);
    if (!exists) next.ui.selectedCategoryByView.library = next.categories[0]?.id || null;
  }

  // Ensure per-view plan selection is valid
  if (next.ui?.selectedCategoryByView?.plan) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.plan);
    if (!exists) next.ui.selectedCategoryByView.plan = next.categories[0]?.id || null;
  }
  // Ensure per-view pilotage selection is valid
  if (next.ui?.selectedCategoryByView?.pilotage) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.pilotage);
    if (!exists) next.ui.selectedCategoryByView.pilotage = next.categories[0]?.id || null;
  }

  // goals (V2 normalize)
  if (!Array.isArray(next.goals)) next.goals = [];
  if (!Array.isArray(next.habits)) next.habits = [];
  next.habits = next.habits.map((h, i) => normalizeLegacyHabit(h, i));
  next.goals = next.goals.map((g) => backfillGoalLegacyFields(g));
  next = mergeLegacyHabitsIntoGoals(next);
  next.goals = next.goals.map((g) => backfillGoalLegacyFields(g));
  next.goals = next.goals.map((g, i) => normalizeGoal(g, i, next.categories));
  // Safety: enforce mandatory lifecycle period on PROCESS goals after normalizeGoal.
  {
    const todayKey = toLocalDateKey();
    next.goals = next.goals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (!isProcess(g)) return g;

      const planType = typeof g.planType === "string" ? g.planType : "ACTION";
      const from = normalizeDateKeyLoose(g.activeFrom) || "";
      const to = normalizeDateKeyLoose(g.activeTo) || "";

      if (planType === "ONE_OFF") {
        const oneOff = normalizeDateKeyLoose(g.oneOffDate) || from || todayKey;
        return { ...g, lifecycleMode: "FIXED", activeFrom: oneOff, activeTo: oneOff };
      }

      const activeFrom = from || todayKey;
      const activeTo = to || addDaysDateKey(activeFrom, 29);
      const clampedTo = compareDateKeys(activeTo, activeFrom) < 0 ? activeFrom : activeTo;
      const lifecycleMode = normalizeLifecycleMode(g.lifecycleMode) || "FIXED";
      return { ...g, lifecycleMode, activeFrom, activeTo: clampedTo };
    });
  }
  next.goals = next.goals.map((g) => ({
    ...g,
    status: g.status === "abandoned" ? "invalid" : g.status,
  }));

  // --- Semantic cleanup: prevent cross-category / invalid parent links (PROCESS -> OUTCOME only)
  {
    const byId = new Map(next.goals.map((g) => [g.id, g]));
    next.goals = next.goals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (!isProcess(g)) return g;

      const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
      if (!rawParent) {
        // Ensure both legacy fields are aligned
        return { ...g, parentId: null, primaryGoalId: null };
      }

      const parent = byId.get(rawParent);
      const parentOk = Boolean(parent && isOutcome(parent) && parent.categoryId && parent.categoryId === g.categoryId);

      if (!parentOk) {
        // Do NOT delete the habit; just detach it.
        return { ...g, parentId: null, primaryGoalId: null };
      }

      // Keep both fields consistent
      return { ...g, parentId: parent.id, primaryGoalId: parent.id };
    });
  }

  // Enforce: mainGoalId reflects only the OUTCOME with priority === "prioritaire"
  const prioritaireByCategory = new Map();
  for (const g of next.goals) {
    if (!isOutcome(g)) continue;
    if (!g.categoryId) continue;
    if (g.priority !== "prioritaire") continue;

    const prevBest = prioritaireByCategory.get(g.categoryId);
    if (!prevBest) {
      prioritaireByCategory.set(g.categoryId, g);
      continue;
    }

    const orderScore = (x) => (typeof x.order === "number" ? x.order : Number.POSITIVE_INFINITY);
    if (orderScore(g) < orderScore(prevBest)) prioritaireByCategory.set(g.categoryId, g);
  }

  if (prioritaireByCategory.size) {
    next.goals = next.goals.map((g) => {
      if (!isOutcome(g)) return g;
      if (!g.categoryId || g.priority !== "prioritaire") return g;
      const picked = prioritaireByCategory.get(g.categoryId);
      if (picked && picked.id === g.id) return g;
      return { ...g, priority: "secondaire" };
    });
  }

  next.categories = next.categories.map((cat) => {
    const picked = prioritaireByCategory.get(cat.id) || null;
    return { ...cat, mainGoalId: picked ? picked.id : null };
  });

  // `mainGoalId` is a UI convenience, but it must follow the Today (home) context,
  // not the legacy global `selectedCategoryId` (which is kept for backward compatibility).
  const homeCategoryId = next.ui?.selectedCategoryByView?.home || next.ui?.selectedCategoryId || null;
  const homeCategoryForMain =
    next.categories.find((cat) => cat.id === homeCategoryId) || next.categories[0] || null;
  next.ui.mainGoalId = homeCategoryForMain?.mainGoalId || null;

  // Onboarding completion rule:
  if (!next.ui.onboardingCompleted) {
    const step = Number(next.ui.onboardingStep) || 1;
    const nameOk = Boolean((next.profile?.name || "").trim());
    const whyOk = Boolean((next.profile?.whyText || "").trim());
    const hasOutcome = next.goals.some((g) => isOutcome(g));
    const hasProcess = next.goals.some((g) => isProcess(g));

    if (step >= 3 && nameOk && whyOk && (hasOutcome || hasProcess)) {
      next.ui.onboardingCompleted = true;
    }
  }

  // habits/checks
  if (!Array.isArray(next.reminders)) next.reminders = [];
  next.reminders = next.reminders.map((r, i) => normalizeReminder(r, i));
  if (!Array.isArray(next.occurrences)) next.occurrences = [];
  if (!next.microChecks || typeof next.microChecks !== "object") next.microChecks = {};

  const migrated = migrateLegacyActivity(next);
  next = migrated.state || next;
  if (migrated.checksLegacy && !next.checksLegacy) {
    next.checksLegacy = migrated.checksLegacy;
  }
  if (migrated.sessionsLegacy && !next.sessionsLegacy) {
    next.sessionsLegacy = migrated.sessionsLegacy;
  }

  // Cleanup: remove legacy timed occurrences/reminders for anytime goals.
  {
    const anytimeGoalIds = new Set();
    for (const g of next.goals || []) {
      if (!g || !isProcess(g)) continue;
      const st = normalizeStartTime(g.startTime);
      const rt = normalizeStartTime(g.reminderTime);
      const sm = normalizeScheduleMode(g.scheduleMode) || normalizeScheduleMode(g.schedule?.scheduleMode);
      const wsd = normalizeWeeklySlotsByDay(g.weeklySlotsByDay) || normalizeWeeklySlotsByDay(g.schedule?.weeklySlotsByDay);
      const hasWeeklySlots = sm === "WEEKLY_SLOTS" && Boolean(wsd);
      if (!st && !rt && g.id && !hasWeeklySlots) anytimeGoalIds.add(g.id);
    }
    if (anytimeGoalIds.size) {
      let removedOccurrences = 0;
      if (Array.isArray(next.occurrences)) {
        const before = next.occurrences.length;
        next.occurrences = next.occurrences.filter((o) => {
          if (!o || !o.goalId) return true;
          if (!anytimeGoalIds.has(o.goalId)) return true;
          return o.start === "00:00";
        });
        removedOccurrences = before - next.occurrences.length;
      }
      let removedReminders = 0;
      if (Array.isArray(next.reminders)) {
        const before = next.reminders.length;
        next.reminders = next.reminders.filter((r) => {
          const gid = typeof r?.goalId === "string" ? r.goalId : "";
          if (!gid || !anytimeGoalIds.has(gid)) return true;
          return false;
        });
        removedReminders = before - next.reminders.length;
      }
      const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
      if (isDev && (removedOccurrences > 0 || removedReminders > 0)) {
        // eslint-disable-next-line no-console
        console.log("[migration] anytime cleanup", {
          goals: Array.from(anytimeGoalIds),
          removedOccurrences,
          removedReminders,
        });
      }
    }
  }

  // Cleanup: prune orphan occurrences/reminders/sessions/checks (goalId not found).
  {
    const goalIds = new Set((next.goals || []).map((g) => g?.id).filter(Boolean));
    let removedOrphanOccurrences = 0;
    if (Array.isArray(next.occurrences)) {
      const before = next.occurrences.length;
      next.occurrences = next.occurrences.filter((o) => o && goalIds.has(o.goalId));
      removedOrphanOccurrences = before - next.occurrences.length;
    }
    let removedOrphanReminders = 0;
    if (Array.isArray(next.reminders)) {
      const before = next.reminders.length;
      next.reminders = next.reminders.filter((r) => r && goalIds.has(r.goalId));
      removedOrphanReminders = before - next.reminders.length;
    }
    let removedOrphanSessions = 0;
    if (Array.isArray(next.sessions)) {
      const before = next.sessions.length;
      next.sessions = next.sessions
        .map((s) => {
          if (!s || typeof s !== "object") return s;
          const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => goalIds.has(id)) : [];
          const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => goalIds.has(id)) : [];
          return { ...s, habitIds, doneHabitIds };
        })
        .filter((s) => {
          if (!s || typeof s !== "object") return false;
          const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
          const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
          return hasHabits || hasDone;
        });
      removedOrphanSessions = before - next.sessions.length;
    }
    let removedOrphanChecks = 0;
    if (next.checks && typeof next.checks === "object") {
      const nextChecks = {};
      for (const [key, bucket] of Object.entries(next.checks)) {
        const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => goalIds.has(id)) : [];
        const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
        if (habits.length || Object.keys(micro).length) {
          nextChecks[key] = { ...bucket, habits, micro };
        } else {
          removedOrphanChecks += 1;
        }
      }
      next.checks = nextChecks;
    }
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (isDev && (removedOrphanOccurrences || removedOrphanReminders || removedOrphanSessions || removedOrphanChecks)) {
      // eslint-disable-next-line no-console
      console.log("[migration] orphan cleanup", {
        removedOrphanOccurrences,
        removedOrphanReminders,
        removedOrphanSessions,
        removedOrphanChecks,
      });
    }
  }
  next.sessions = [];
  next.checks = {};

  if (!Array.isArray(next.scheduleRules)) next.scheduleRules = [];
  if (!Array.isArray(next.sessionHistory)) next.sessionHistory = [];
  {
    const nowIso = new Date().toISOString();
    const existingRaw = Array.isArray(next.scheduleRules) ? next.scheduleRules : [];
    const normalizedRules = [];
    const existingSourceKeys = new Set();

    for (const raw of existingRaw) {
      const normalized = normalizeScheduleRule(raw);
      if (!normalized) continue;
      const sourceKey = normalized.sourceKey || buildScheduleRuleSourceKey(normalized);
      if (!sourceKey) continue;
      const createdAt = normalized.createdAt || nowIso;
      const updatedAt = normalized.updatedAt || createdAt;
      const merged = {
        ...normalized,
        sourceKey,
        createdAt,
        updatedAt,
      };
      normalizedRules.push(merged);
      existingSourceKeys.add(sourceKey);
    }

    const shouldSeed = prevSchemaVersion < SCHEMA_VERSION || normalizedRules.length === 0;
    if (shouldSeed) {
      const actions = Array.isArray(next.goals) ? next.goals : [];
      for (const action of actions) {
        if (!action || !isProcess(action)) continue;
        const desired = buildScheduleRulesFromAction(action);
        for (const rule of desired) {
          const sourceKey = rule.sourceKey || buildScheduleRuleSourceKey(rule);
          if (!sourceKey || existingSourceKeys.has(sourceKey)) continue;
          existingSourceKeys.add(sourceKey);
          normalizedRules.push({
            ...rule,
            id: rule.id || uid(),
            actionId: action.id,
            sourceKey,
            isActive: rule.isActive !== false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    }

    next.scheduleRules = normalizedRules;
  }

  if (next.schemaVersion < SCHEMA_VERSION) next.schemaVersion = SCHEMA_VERSION;

  const normalized = normalizeGoalsState(next);

  // Defensive re-validation after normalizeGoalsState
  {
    const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
    const goals = Array.isArray(normalized.goals) ? normalized.goals : [];
    const fixedCategories = cats.map((cat) => {
      const outcomes = goals.filter((x) => isOutcome(x) && x.categoryId === cat.id && x.priority === "prioritaire");
      if (!outcomes.length) return { ...cat, mainGoalId: null };

      const orderScore = (x) => (typeof x.order === "number" ? x.order : Number.POSITIVE_INFINITY);
      let best = outcomes[0];
      for (const o of outcomes.slice(1)) if (orderScore(o) < orderScore(best)) best = o;
      return { ...cat, mainGoalId: best.id };
    });

    normalized.categories = fixedCategories;

    const homeCatId = normalized.ui?.selectedCategoryByView?.home || normalized.ui?.selectedCategoryId || fixedCategories[0]?.id || null;
    const homeCat = homeCatId ? fixedCategories.find((c) => c.id === homeCatId) || null : null;
    normalized.ui = {
      ...(normalized.ui || {}),
      mainGoalId: homeCat?.mainGoalId || null,
    };
  }

  // Re-validate per-view selections after normalizeGoalsState
  const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
  const first = cats[0]?.id || null;
  const goalList = Array.isArray(normalized.goals) ? normalized.goals : [];

  const scv = normalized.ui?.selectedCategoryByView || { home: null, library: null, plan: null, pilotage: null };

  const safeHome = scv.home && cats.some((c) => c.id === scv.home) ? scv.home : first;
  const safeLibrary = scv.library && cats.some((c) => c.id === scv.library) ? scv.library : first;
  const safePlan = scv.plan && cats.some((c) => c.id === scv.plan) ? scv.plan : first;
  const safePilotage = scv.pilotage && cats.some((c) => c.id === scv.pilotage) ? scv.pilotage : first;

  // Keep legacy `selectedCategoryId` as the Plan context to avoid coupling Today/Library to it.
  const legacySelectedCategoryId = safePlan || null;
  const rawLibrarySelected = normalized.ui?.librarySelectedCategoryId || null;
  const safeLibrarySelected = rawLibrarySelected && cats.some((c) => c.id === rawLibrarySelected) ? rawLibrarySelected : null;
  const rawOpenGoalEditId = normalized.ui?.openGoalEditId || null;
  const safeOpenGoalEditId = rawOpenGoalEditId && goalList.some((g) => g.id === rawOpenGoalEditId) ? rawOpenGoalEditId : null;

  return {
    ...normalized,
    ui: {
      ...(normalized.ui || {}),
      selectedCategoryId: legacySelectedCategoryId,
      mainGoalId: normalized.ui?.mainGoalId || null,
      librarySelectedCategoryId: safeLibrarySelected,
      openGoalEditId: safeOpenGoalEditId,
      selectedCategoryByView: {
        home: safeHome,
        library: safeLibrary,
        plan: safePlan,
        pilotage: safePilotage,
      },
    },
  };
}

let lastInvariantSig = "";
let lastMissingBoundsSig = "";
let lastActiveSessionSig = "";

function isDev() {
  return typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
}

export function assertStateInvariants(state) {
  if (!isDev()) return state;
  if (!state || typeof state !== "object") return state;

  const scheduleRules = Array.isArray(state.scheduleRules) ? state.scheduleRules : [];
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const sessionHistory = Array.isArray(state.sessionHistory) ? state.sessionHistory : [];
  const activeSession =
    state.ui && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;

  const duplicates = [];
  if (scheduleRules.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const rule of scheduleRules) {
      if (!rule || typeof rule !== "object") continue;
      const actionId = typeof rule.actionId === "string" ? rule.actionId : "";
      const sourceKey = typeof rule.sourceKey === "string" ? rule.sourceKey : "";
      if (!actionId || !sourceKey) continue;
      const key = `${actionId}::${sourceKey}`;
      if (seen.has(key)) dupKeys.push(key);
      else seen.add(key);
    }
    if (dupKeys.length) duplicates.push({ type: "scheduleRules", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (occurrences.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const occ of occurrences) {
      if (!occ || typeof occ !== "object") continue;
      const ruleId = typeof occ.scheduleRuleId === "string" ? occ.scheduleRuleId : "";
      const date = typeof occ.date === "string" ? occ.date : "";
      if (!ruleId || !date) continue;
      const key = `${ruleId}::${date}`;
      if (seen.has(key)) dupKeys.push(key);
      else seen.add(key);
    }
    if (dupKeys.length) duplicates.push({ type: "occurrences", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (sessionHistory.length) {
    const seen = new Set();
    const dupKeys = [];
    for (const s of sessionHistory) {
      if (!s || typeof s !== "object") continue;
      const occId = typeof s.occurrenceId === "string" ? s.occurrenceId : "";
      if (!occId) continue;
      if (seen.has(occId)) dupKeys.push(occId);
      else seen.add(occId);
    }
    if (dupKeys.length) duplicates.push({ type: "sessionHistory", count: dupKeys.length, sample: dupKeys.slice(0, 5) });
  }

  if (duplicates.length) {
    const sig = JSON.stringify(duplicates);
    if (sig !== lastInvariantSig) {
      lastInvariantSig = sig;
      // eslint-disable-next-line no-console
      console.warn("[invariants] duplicate keys detected", duplicates);
    }
  }

  if (activeSession && typeof activeSession === "object") {
    const occurrenceId = typeof activeSession.occurrenceId === "string" ? activeSession.occurrenceId : "";
    if (!occurrenceId) {
      const sig = typeof activeSession.id === "string" ? activeSession.id : "activeSession";
      if (sig !== lastActiveSessionSig) {
        lastActiveSessionSig = sig;
        // eslint-disable-next-line no-console
        console.warn("[invariants] activeSession missing occurrenceId", { id: sig });
      }
    } else if (activeSession.status === "partial") {
      const occurrence = occurrences.find((occ) => occ && occ.id === occurrenceId) || null;
      if (occurrence && isFinalOccurrenceStatus(occurrence.status)) {
        const sig = `${occurrenceId}:${occurrence.status}`;
        if (sig !== lastActiveSessionSig) {
          lastActiveSessionSig = sig;
          // eslint-disable-next-line no-console
          console.warn("[invariants] activeSession references final occurrence", { occurrenceId, status: occurrence.status });
        }
      }
    }
  }

  if (occurrences.length) {
    const today = toLocalDateKey(new Date());
    const missing = [];
    for (const occ of occurrences) {
      if (!occ || typeof occ !== "object") continue;
      if (occ.status !== "planned") continue;
      if (typeof occ.date !== "string" || !occ.date) continue;
      if (today && occ.date >= today) continue;
      if (occ.endAt || occ.windowEndAt) continue;
      missing.push(occ.id || `${occ.goalId || ""}:${occ.date}`);
    }
    if (missing.length) {
      const sig = missing.join("|");
      if (sig !== lastMissingBoundsSig) {
        lastMissingBoundsSig = sig;
        // eslint-disable-next-line no-console
        console.warn("[invariants] missing bounds for planned past occurrences", {
          count: missing.length,
          sample: missing.slice(0, 5),
        });
      }
    }
  }

  return state;
}

export function usePersistedState(React) {
  const { useEffect, useState } = React;
  const demoMode = isDemoMode();
  const [data, setData] = useState(() => {
    if (demoMode) return migrate(demoData());
    return migrate(loadState() || initialData());
  });
  useEffect(() => {
    if (demoMode) return;
    saveState(data);
  }, [data, demoMode]);
  useEffect(() => {
    assertStateInvariants(data);
  }, [data]);
  return [data, setData];
}

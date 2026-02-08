import { addDaysLocal, normalizeLocalDateKey, normalizeStartTime } from "../../utils/datetime";

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
  return addDaysLocal(dateKey, days);
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

export {
  SCHEMA_VERSION,
  MEASURE_TYPES,
  TRACKING_MODES,
  normalizeLifecycleMode,
  normalizeCompletionMode,
  normalizeMissPolicy,
  normalizeInt,
  normalizeFloat,
  normalizeDateKeyLoose,
  addDaysDateKey,
  compareDateKeys,
  normalizeScheduleMode,
  normalizeWeeklySlotsByDay,
  normalizeCadence,
  normalizeRepeat,
  normalizeDaysOfWeek,
  normalizeStartTime,
  normalizeDurationMinutes,
  normalizeQuantityValue,
  normalizeQuantityUnit,
  normalizeQuantityPeriod,
  normalizeGoalPriority,
  cadenceToFreqUnit,
  inferMeasureTypeFromUnit,
};

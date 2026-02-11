const MINUTES_PER_DAY = 24 * 60;
const TIME_RE_STRICT = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_RE_LOOSE = /^([01]?\d|2[0-3]):([0-5]?\d)$/;
const weekdayShortFormatters = new Map();
const WEEKDAY_FALLBACK_FR = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

function normalizeDayOffset(days) {
  return Number.isFinite(days) ? Math.trunc(days) : 0;
}

export function toLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeLocalDateKey(key) {
  if (key instanceof Date) return toLocalDateKey(key);
  if (typeof key !== "string") return "";
  const trimmed = key.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map((v) => parseInt(v, 10));
    const rebuilt = new Date(y, m - 1, d, 12, 0, 0, 0);
    return toLocalDateKey(rebuilt) === trimmed ? trimmed : "";
  }
  if (trimmed.length >= 10) {
    const candidate = trimmed.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
    const [y, m, d] = candidate.split("-").map((v) => parseInt(v, 10));
    const rebuilt = new Date(y, m - 1, d, 12, 0, 0, 0);
    return toLocalDateKey(rebuilt) === candidate ? candidate : "";
  }
  return "";
}

export function fromLocalDateKey(dateKey) {
  const cleaned = normalizeLocalDateKey(dateKey);
  if (cleaned) {
    const [y, m, d] = cleaned.split("-").map((v) => parseInt(v, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    }
  }
  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);
  return fallback;
}

export function todayLocalKey() {
  return toLocalDateKey(new Date());
}

export function addDaysLocal(dateOrKey, days) {
  const normalized =
    dateOrKey instanceof Date ? toLocalDateKey(dateOrKey) : normalizeLocalDateKey(typeof dateOrKey === "string" ? dateOrKey : "");
  if (!normalized) return "";
  const base = fromLocalDateKey(normalized);
  base.setDate(base.getDate() + normalizeDayOffset(days));
  return toLocalDateKey(base);
}

export function buildDateRangeLocalKeys(fromKey, toKey) {
  const from = normalizeLocalDateKey(fromKey);
  const to = normalizeLocalDateKey(toKey);
  if (!from || !to || to < from) return [];
  const start = fromLocalDateKey(from);
  const end = fromLocalDateKey(to);
  if (!start || !end) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function isSameDateKey(aKey, bKey) {
  const a = normalizeLocalDateKey(aKey);
  const b = normalizeLocalDateKey(bKey);
  return Boolean(a && b && a === b);
}

export function isSameLocalDay(a, b) {
  const aKey = a instanceof Date ? toLocalDateKey(a) : normalizeLocalDateKey(a);
  const bKey = b instanceof Date ? toLocalDateKey(b) : normalizeLocalDateKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

export function appDowFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

export function parseTimeToMinutes(value) {
  const normalized = normalizeStartTime(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function clampTimeToDay(minutes) {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)));
}

export function minutesToTimeStr(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const rounded = Math.round(minutes);
  if (rounded < 0 || rounded > MINUTES_PER_DAY - 1) return "";
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isValidTimeStr(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return TIME_RE_STRICT.test(raw);
}

export function normalizeStartTime(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const strict = raw.match(TIME_RE_STRICT);
  if (strict) return raw;
  const loose = raw.match(TIME_RE_LOOSE);
  if (!loose) return "";
  const h = Number(loose[1]);
  const m = Number(loose[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function compareTimeStr(a, b) {
  const aMin = parseTimeToMinutes(a);
  const bMin = parseTimeToMinutes(b);
  if (!Number.isFinite(aMin) && !Number.isFinite(bMin)) return 0;
  if (!Number.isFinite(aMin)) return 1;
  if (!Number.isFinite(bMin)) return -1;
  return aMin - bMin;
}

export function getWeekdayShortLabel(date, locale = undefined) {
  if (!(date instanceof Date)) return "";
  try {
    const key = locale || "default";
    let formatter = weekdayShortFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale || undefined, { weekday: "short" });
      weekdayShortFormatters.set(key, formatter);
    }
    const raw = formatter.format(date);
    const cleaned = raw.replace(/[^A-Za-z]/g, "");
    const label = cleaned || raw;
    return label.slice(0, 3).toUpperCase();
  } catch (err) {
    void err;
    return WEEKDAY_FALLBACK_FR[date.getDay()] || "";
  }
}

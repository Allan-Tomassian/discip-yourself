import { uid } from "../utils/helpers";

const STATUS_VALUES = new Set(["planned", "done", "skipped"]);

const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]); // 1=Mon .. 7=Sun (app convention)

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toHM(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function dateKeyFromDate(d) {
  // expects Date
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function appDowFromDate(d) {
  // JS: 0=Sun..6=Sat => App: 1=Mon..7=Sun
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function occurrenceKey(goalId, date, start) {
  return `${goalId}::${date}::${start}`;
}

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function normalizeStatus(status) {
  const raw = typeof status === "string" ? status : "";
  return STATUS_VALUES.has(raw) ? raw : "planned";
}

function normalizeDurationMinutes(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded >= 0 ? rounded : null;
}

function normalizeDateKey(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  // minimal YYYY-MM-DD sanity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  return raw;
}

function normalizeTimeHM(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) return "";
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${pad2(h)}:${pad2(m)}`;
}

export function listOccurrencesByDate(date, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof date !== "string" || !date.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.date === date);
}

export function listOccurrencesForGoal(goalId, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof goalId !== "string" || !goalId.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.goalId === goalId);
}

export function addOccurrence(goalId, date, start, durationMinutes, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof goalId !== "string" || !goalId.trim()) return occurrences.slice();

  const cleanDate = normalizeDateKey(date);
  const cleanStart = normalizeTimeHM(start);
  if (!cleanDate) return occurrences.slice();
  if (!cleanStart) return occurrences.slice();

  const exists = occurrences.some((o) => o && o.goalId === goalId && o.date === cleanDate && o.start === cleanStart);
  if (exists) return occurrences.slice();

  const occurrence = {
    id: uid(),
    goalId,
    date: cleanDate,
    start: cleanStart,
    durationMinutes: normalizeDurationMinutes(durationMinutes),
    status: "planned",
  };

  return [...occurrences, occurrence];
}

export function updateOccurrence(id, patch, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof id !== "string" || !id.trim()) return occurrences.slice();
  if (!patch || typeof patch !== "object") return occurrences.slice();

  const nextPatch = { ...patch };
  if ("status" in nextPatch) nextPatch.status = normalizeStatus(nextPatch.status);
  if ("durationMinutes" in nextPatch) nextPatch.durationMinutes = normalizeDurationMinutes(nextPatch.durationMinutes);

  return occurrences.map((o) => {
    if (!o || o.id !== id) return o;
    return { ...o, ...nextPatch, id: o.id };
  });
}

export function deleteOccurrence(id, source) {
  const occurrences = resolveOccurrences(source);
  if (typeof id !== "string" || !id.trim()) return occurrences.slice();
  return occurrences.filter((o) => o && o.id !== id);
}

// --- New: month helper (used by calendar views) ---
export function listOccurrencesByMonth(year, month1to12, source) {
  const occurrences = resolveOccurrences(source);
  const y = Number(year);
  const m = Number(month1to12);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return occurrences.slice();
  const prefix = `${y}-${pad2(m)}-`;
  return occurrences.filter((o) => o && typeof o.date === "string" && o.date.startsWith(prefix));
}

// --- New: upsert by (goalId,date,start) to avoid duplicates ---
export function upsertOccurrence(goalId, date, start, durationMinutes, patch, source) {
  const occurrences = resolveOccurrences(source);
  const g = typeof goalId === "string" ? goalId.trim() : "";
  const d = normalizeDateKey(date);
  const s = normalizeTimeHM(start);
  if (!g || !d || !s) return occurrences.slice();

  const key = occurrenceKey(g, d, s);
  const nextPatch = patch && typeof patch === "object" ? { ...patch } : {};
  if ("status" in nextPatch) nextPatch.status = normalizeStatus(nextPatch.status);
  if ("durationMinutes" in nextPatch) nextPatch.durationMinutes = normalizeDurationMinutes(nextPatch.durationMinutes);

  let found = false;
  const next = occurrences.map((o) => {
    if (!o || o.goalId !== g || o.date !== d || o.start !== s) return o;
    found = true;
    return {
      ...o,
      ...nextPatch,
      id: o.id,
      goalId: g,
      date: d,
      start: s,
      durationMinutes: normalizeDurationMinutes(
        typeof nextPatch.durationMinutes !== "undefined" ? nextPatch.durationMinutes : o.durationMinutes
      ),
      status: normalizeStatus(typeof nextPatch.status !== "undefined" ? nextPatch.status : o.status),
    };
  });

  if (found) return next;

  const created = {
    id: uid(),
    goalId: g,
    date: d,
    start: s,
    durationMinutes: normalizeDurationMinutes(durationMinutes),
    status: "planned",
    ...nextPatch,
  };
  // ensure normalized fields win
  created.goalId = g;
  created.date = d;
  created.start = s;
  if ("status" in created) created.status = normalizeStatus(created.status);
  if ("durationMinutes" in created) created.durationMinutes = normalizeDurationMinutes(created.durationMinutes);

  return [...occurrences, created];
}

// --- New: generate occurrences from a goal schedule (non-destructive; returns new list) ---
// Schedule shape supported (already used elsewhere in app):
// schedule.daysOfWeek: [1..7]
// schedule.timeSlots: ["HH:MM", ...]
// schedule.durationMinutes: number
// schedule.remindersEnabled: boolean (ignored here)
export function ensureOccurrencesForGoalBetween(goal, startDateKey, endDateKey, source, options = {}) {
  const occurrences = resolveOccurrences(source);
  if (!goal || typeof goal !== "object") return occurrences.slice();
  const goalId = typeof goal.id === "string" ? goal.id.trim() : "";
  if (!goalId) return occurrences.slice();

  const startKey = normalizeDateKey(startDateKey);
  const endKey = normalizeDateKey(endDateKey);
  if (!startKey || !endKey) return occurrences.slice();

  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const daysOfWeek = Array.isArray(schedule?.daysOfWeek) ? schedule.daysOfWeek.filter((d) => DOW_VALUES.has(d)) : [];
  const timeSlotsRaw = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
  const timeSlots = timeSlotsRaw.map(normalizeTimeHM).filter(Boolean);

  if (!timeSlots.length) return occurrences.slice();

  // if daysOfWeek is empty, assume every day
  const allowAllDays = daysOfWeek.length === 0;

  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return occurrences.slice();

  const maxDays = Number.isFinite(options.maxDays) ? options.maxDays : 120;
  const durationMinutes = normalizeDurationMinutes(schedule?.durationMinutes ?? goal.sessionMinutes);

  // Build fast lookup for existing occurrences by key
  const existingKeys = new Set();
  for (const o of occurrences) {
    if (!o || o.goalId !== goalId) continue;
    const d = typeof o.date === "string" ? o.date : "";
    const s = typeof o.start === "string" ? o.start : "";
    if (!d || !s) continue;
    existingKeys.add(occurrenceKey(goalId, d, s));
  }

  let next = occurrences.slice();
  let daysCount = 0;
  for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    daysCount += 1;
    if (daysCount > maxDays) break;

    const dow = appDowFromDate(cursor);
    if (!allowAllDays && !daysOfWeek.includes(dow)) continue;

    const dateKey = dateKeyFromDate(cursor);
    for (const t of timeSlots) {
      const key = occurrenceKey(goalId, dateKey, t);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      next = [...next, {
        id: uid(),
        goalId,
        date: dateKey,
        start: t,
        durationMinutes,
        status: "planned",
      }];
    }
  }

  return next;
}

// --- New: mark all occurrences for a goal/date as done or skipped ---
export function setOccurrencesStatusForGoalDate(goalId, date, status, source) {
  const occurrences = resolveOccurrences(source);
  const g = typeof goalId === "string" ? goalId.trim() : "";
  const d = normalizeDateKey(date);
  if (!g || !d) return occurrences.slice();
  const st = normalizeStatus(status);
  return occurrences.map((o) => {
    if (!o || o.goalId !== g || o.date !== d) return o;
    return { ...o, status: st };
  });
}

// --- New: set a single occurrence status by (goalId,date,start) ---
export function setOccurrenceStatus(goalId, date, start, status, source) {
  const occurrences = resolveOccurrences(source);
  const g = typeof goalId === "string" ? goalId.trim() : "";
  const d = normalizeDateKey(date);
  const s = normalizeTimeHM(start);
  if (!g || !d || !s) return occurrences.slice();
  const st = normalizeStatus(status);
  return occurrences.map((o) => {
    if (!o || o.goalId !== g || o.date !== d || o.start !== s) return o;
    return { ...o, status: st };
  });
}

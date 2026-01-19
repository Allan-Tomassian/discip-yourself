import { uid } from "../utils/helpers";
import { normalizeLocalDateKey } from "../utils/dateKey";

const STATUS_VALUES = new Set(["planned", "done", "skipped"]);

function pad2(n) {
  return String(n).padStart(2, "0");
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
  return normalizeLocalDateKey(value);
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
  const raw = typeof status === "string" ? status : "";
  if (!STATUS_VALUES.has(raw)) return occurrences.slice();
  const st = normalizeStatus(raw);
  return occurrences.map((o) => {
    if (!o || o.goalId !== g || o.date !== d || o.start !== s) return o;
    return { ...o, status: st };
  });
}

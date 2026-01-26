import { uid } from "../utils/helpers";
import { normalizeLocalDateKey } from "../utils/dateKey";

const STATUS_VALUES = new Set(["planned", "done", "skipped", "canceled"]);
const POINTS_BASE = 10;
const POINTS_BONUS_LINKED = 2;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function resolveOccurrences(source) {
  if (Array.isArray(source)) return source;
  if (source && typeof source === "object") {
    const list = source.occurrences;
    if (Array.isArray(list)) return list;
  }
  return [];
}

function resolveOutcomeIdForGoal(goalId, source) {
  if (!source || typeof source !== "object") return null;
  const goals = Array.isArray(source.goals) ? source.goals : [];
  const goal = goals.find((g) => g && g.id === goalId) || null;
  if (!goal) return null;
  const rawOutcome = typeof goal.outcomeId === "string" ? goal.outcomeId.trim() : "";
  const rawParent = typeof goal.parentId === "string" ? goal.parentId.trim() : "";
  return rawParent || rawOutcome || null;
}

function applyDoneFields(occurrence, status, source) {
  if (status !== "done") {
    return { ...occurrence, doneAt: null, pointsAwarded: null };
  }
  const outcomeId = resolveOutcomeIdForGoal(occurrence.goalId, source);
  const points = POINTS_BASE + (outcomeId ? POINTS_BONUS_LINKED : 0);
  return {
    ...occurrence,
    doneAt: occurrence.doneAt || new Date().toISOString(),
    pointsAwarded: points,
  };
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

function normalizeSlotKey(value) {
  return normalizeTimeHM(value);
}

function resolveOccurrenceSlotKey(occurrence) {
  const raw = typeof occurrence?.start === "string" ? occurrence.start : occurrence?.slotKey;
  return normalizeSlotKey(raw);
}

function sortByStart(a, b) {
  const sa = typeof a?.start === "string" ? a.start : "";
  const sb = typeof b?.start === "string" ? b.start : "";
  if (sa === sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb);
}

export function findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, preferredStart = "") {
  const list = resolveOccurrences(occurrences);
  const g = typeof goalId === "string" ? goalId.trim() : "";
  const d = normalizeDateKey(dateKey);
  if (!g || !d) return null;
  const matches = list.filter((o) => o && o.goalId === g && o.date === d);
  if (!matches.length) return null;
  const preferred = normalizeTimeHM(preferredStart);
  if (preferred) {
    const exact = matches.find((o) => o && (o.start === preferred || o.slotKey === preferred));
    if (exact) return exact;
  }
  const midnight = matches.find((o) => o && o.start === "00:00");
  if (midnight) return midnight;
  const sorted = matches.slice().sort(sortByStart);
  return sorted[0] || null;
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

  const exists = occurrences.some((o) => {
    if (!o || o.goalId !== goalId || o.date !== cleanDate) return false;
    const slotKey = resolveOccurrenceSlotKey(o);
    return slotKey ? slotKey === cleanStart : o.start === cleanStart;
  });
  if (exists) return occurrences.slice();

  const occurrence = {
    id: uid(),
    goalId,
    date: cleanDate,
    start: cleanStart,
    slotKey: cleanStart,
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
    const nextStatus = "status" in nextPatch ? nextPatch.status : o.status;
    return applyDoneFields({ ...o, ...nextPatch, id: o.id }, nextStatus, source);
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

  const nextPatch = patch && typeof patch === "object" ? { ...patch } : {};
  const slotKey = normalizeSlotKey(s);
  nextPatch.slotKey = slotKey;
  if ("status" in nextPatch) nextPatch.status = normalizeStatus(nextPatch.status);
  if ("durationMinutes" in nextPatch) nextPatch.durationMinutes = normalizeDurationMinutes(nextPatch.durationMinutes);

  let found = false;
  const next = occurrences.map((o) => {
    if (!o || o.goalId !== g || o.date !== d) return o;
    const existingSlot = resolveOccurrenceSlotKey(o);
    if (!existingSlot || existingSlot !== slotKey) return o;
    found = true;
    const merged = {
      ...o,
      ...nextPatch,
      id: o.id,
      goalId: g,
      date: d,
      start: s,
      slotKey,
      durationMinutes: normalizeDurationMinutes(
        typeof nextPatch.durationMinutes !== "undefined" ? nextPatch.durationMinutes : o.durationMinutes
      ),
      status: normalizeStatus(typeof nextPatch.status !== "undefined" ? nextPatch.status : o.status),
    };
    return applyDoneFields(merged, merged.status, source);
  });

  if (found) return next;

  const created = {
    id: uid(),
    goalId: g,
    date: d,
    start: s,
    slotKey,
    durationMinutes: normalizeDurationMinutes(durationMinutes),
    status: "planned",
    ...nextPatch,
  };
  // ensure normalized fields win
  created.goalId = g;
  created.date = d;
  created.start = s;
  created.slotKey = slotKey;
  if ("status" in created) created.status = normalizeStatus(created.status);
  if ("durationMinutes" in created) created.durationMinutes = normalizeDurationMinutes(created.durationMinutes);

  const finalized = applyDoneFields(created, created.status, source);
  return [...occurrences, finalized];
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
    return applyDoneFields({ ...o, status: st }, st, source);
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
    return applyDoneFields({ ...o, status: st }, st, source);
  });
}

import { uid } from "../utils/helpers";

const STATUS_VALUES = new Set(["planned", "done", "skipped"]);

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
  if (typeof date !== "string" || !date.trim()) return occurrences.slice();
  if (typeof start !== "string" || !start.trim()) return occurrences.slice();

  const occurrence = {
    id: uid(),
    goalId,
    date,
    start,
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

import { normalizeLocalDateKey } from "../utils/dateKey";
import { isFinalOccurrenceStatus as isFinalOccurrenceStatusFromMetrics } from "./metrics";

export const isFinalOccurrenceStatus = isFinalOccurrenceStatusFromMetrics;

function normalizeTimeHM(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) return "";
  return raw;
}

function classifyOccurrence(occ) {
  if (!occ || typeof occ !== "object") return "window";
  const timeType = occ.timeType === "fixed" ? "fixed" : occ.timeType === "window" ? "window" : "";
  if (timeType === "fixed") return "fixed";
  const hasWindowBounds = Boolean(occ.windowStartAt || occ.windowEndAt);
  if ((occ.noTime === true || occ.start === "00:00") && !hasWindowBounds) return "anytime";
  if (timeType === "window" || occ.noTime === true) return "window";
  if (typeof occ.start === "string" && occ.start && occ.start !== "00:00") return "fixed";
  return "window";
}

export function getOccurrenceEffectiveTime(occ) {
  if (!occ || typeof occ !== "object") return "99:99";
  const kind = classifyOccurrence(occ);
  if (kind === "fixed") {
    return normalizeTimeHM(occ.start) || "99:99";
  }
  const resolved = normalizeTimeHM(occ.resolvedStart);
  return resolved || "99:99";
}

function compareStrings(a, b) {
  const sa = typeof a === "string" ? a : "";
  const sb = typeof b === "string" ? b : "";
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

export function resolveExecutableOccurrence(state, { dateKey, goalIds } = {}) {
  const date = normalizeLocalDateKey(dateKey);
  const ids = Array.isArray(goalIds)
    ? goalIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)
    : [];

  if (!date || !ids.length) return { occurrenceId: null, kind: "not_found" };

  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const candidates = occurrences.filter(
    (o) => o && o.date === date && ids.includes(o.goalId) && o.status === "planned"
  );

  if (!candidates.length) return { occurrenceId: null, kind: "not_found" };

  const sorted = candidates.slice().sort((a, b) => {
    const kindA = classifyOccurrence(a);
    const kindB = classifyOccurrence(b);
    const rankA = kindA === "fixed" ? 0 : kindA === "window" ? 1 : 2;
    const rankB = kindB === "fixed" ? 0 : kindB === "window" ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;

    const timeA = getOccurrenceEffectiveTime(a);
    const timeB = getOccurrenceEffectiveTime(b);
    if (timeA !== timeB) return timeA < timeB ? -1 : 1;

    const goalCmp = compareStrings(a.goalId, b.goalId);
    if (goalCmp !== 0) return goalCmp;
    return compareStrings(a.id, b.id);
  });

  const picked = sorted[0] || null;
  if (!picked || !picked.id) return { occurrenceId: null, kind: "not_found" };
  if (isFinalOccurrenceStatus(picked.status)) return { occurrenceId: picked.id, kind: "final" };
  return { occurrenceId: picked.id, kind: "ok" };
}

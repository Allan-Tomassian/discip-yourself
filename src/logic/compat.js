import { normalizeLocalDateKey } from "../utils/dateKey";
import { normalizeRuntimeSession } from "./sessionRuntime";

export function normalizeOccurrenceForUI(occ) {
  if (!occ || typeof occ !== "object") return occ;
  const rawStart = typeof occ.start === "string" ? occ.start : "";
  const rawSlotKey = typeof occ.slotKey === "string" ? occ.slotKey : "";
  const rawNoTime = occ.noTime === true;

  const nextStart = rawStart;
  const nextSlotKey = rawSlotKey || rawStart;
  const nextNoTime = rawNoTime || nextStart === "00:00";

  const changed = nextStart !== rawStart || nextSlotKey !== rawSlotKey || nextNoTime !== rawNoTime;
  if (!changed) return occ;

  const patch = {};
  patch.start = nextStart;
  patch.slotKey = nextSlotKey;
  patch.noTime = nextNoTime;
  return { ...occ, ...patch };
}

export function normalizeActiveSessionForUI(session) {
  if (!session || typeof session !== "object") return session;
  const normalizedRuntime = normalizeRuntimeSession(session);
  const source = normalizedRuntime && typeof normalizedRuntime === "object" ? normalizedRuntime : session;
  const rawDateKey = typeof source.dateKey === "string" ? source.dateKey : "";
  const rawDate = typeof source.date === "string" ? source.date : "";
  const resolvedDateKey = rawDateKey || normalizeLocalDateKey(rawDate) || rawDateKey;
  const rawHabitIds = Array.isArray(source.habitIds) ? source.habitIds.filter(Boolean) : null;
  const rawStatus = typeof source.status === "string" ? source.status : "";
  const nextStatus = rawStatus || "partial";

  let changed = false;
  if (resolvedDateKey && resolvedDateKey !== rawDateKey) changed = true;
  if (!rawHabitIds) changed = true;
  if (nextStatus !== rawStatus) changed = true;

  if (!changed && normalizedRuntime === session) return session;
  return {
    ...source,
    dateKey: resolvedDateKey || rawDateKey,
    habitIds: rawHabitIds || [],
    status: nextStatus,
  };
}

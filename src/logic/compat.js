import { normalizeLocalDateKey } from "../utils/dateKey";

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
  const rawDateKey = typeof session.dateKey === "string" ? session.dateKey : "";
  const rawDate = typeof session.date === "string" ? session.date : "";
  const resolvedDateKey = rawDateKey || normalizeLocalDateKey(rawDate) || rawDateKey;
  const rawHabitIds = Array.isArray(session.habitIds) ? session.habitIds.filter(Boolean) : null;
  const rawStatus = typeof session.status === "string" ? session.status : "";
  const nextStatus = rawStatus || "partial";

  let changed = false;
  if (resolvedDateKey && resolvedDateKey !== rawDateKey) changed = true;
  if (!rawHabitIds) changed = true;
  if (nextStatus !== rawStatus) changed = true;

  if (!changed) return session;
  return {
    ...session,
    dateKey: resolvedDateKey || rawDateKey,
    habitIds: rawHabitIds || [],
    status: nextStatus,
  };
}

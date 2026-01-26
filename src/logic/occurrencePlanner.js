import { uid } from "../utils/helpers";
import { fromLocalDateKey, normalizeLocalDateKey, todayLocalKey, toLocalDateKey } from "../utils/dateKey";
import { resolveGoalType } from "../domain/goalType";

// P0.4 single source of truth: planned occurrences generation only here.
// Example: const next = ensureWindowForGoal(state, goalId, todayLocalKey(), 14);
// Example: const next = regenerateWindowForGoal(state, goalId, todayLocalKey(), 14);

const STATUS_RANK = { done: 3, planned: 2, skipped: 1 };
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]); // 1=Mon .. 7=Sun (app convention)

function appDowFromDate(d) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function parseTimeToMinutes(hm) {
  const raw = typeof hm === "string" ? hm.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(startMin, durationMinutes, otherStartMin, otherDurationMinutes) {
  if (!Number.isFinite(startMin) || !Number.isFinite(otherStartMin)) return false;
  const d1 = Number.isFinite(durationMinutes) ? durationMinutes : 0;
  const d2 = Number.isFinite(otherDurationMinutes) ? otherDurationMinutes : 0;
  return startMin < otherStartMin + d2 && otherStartMin < startMin + d1;
}

function normalizeTimeSlots(timeSlots) {
  if (!Array.isArray(timeSlots)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of timeSlots) {
    const slot = minutesToTime(parseTimeToMinutes(raw));
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  return out;
}

function resolveTimeMode(goal) {
  const raw = typeof goal?.timeMode === "string" ? goal.timeMode.trim().toUpperCase() : "";
  return raw || "";
}

function resolveGoalSlots(goal, schedule) {
  const mode = resolveTimeMode(goal);
  const goalSlots = normalizeTimeSlots(goal?.timeSlots);
  const scheduleSlots = normalizeTimeSlots(schedule?.timeSlots);
  const start = minutesToTime(parseTimeToMinutes(goal?.startTime));

  if (mode === "SLOTS") {
    return goalSlots.length ? goalSlots : scheduleSlots;
  }
  if (mode === "FIXED") {
    const slot = goalSlots[0] || scheduleSlots[0] || start;
    return slot ? [slot] : [];
  }
  if (mode === "NONE") return [];

  return goalSlots.length ? goalSlots : scheduleSlots;
}

function resolveGoalTimeSlots(goal, schedule) {
  const slots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
  const normalized = normalizeTimeSlots(slots);
  if (normalized.length) return normalized;
  const startAt = typeof goal?.startAt === "string" ? goal.startAt : "";
  const match = startAt.match(/T(\d{2}:\d{2})/);
  return match ? [match[1]] : [];
}

function resolveFallbackSlot(goal) {
  const startAt = typeof goal?.startAt === "string" ? goal.startAt : "";
  const match = startAt.match(/T(\d{2}:\d{2})/);
  return { slot: match ? match[1] : "09:00", fromStartAt: Boolean(match) };
}

function shouldOccurOnDate(goal, dateKey, schedule) {
  const oneOff = normalizeLocalDateKey(goal?.oneOffDate);
  if (oneOff) return oneOff === dateKey;

  const days = Array.isArray(schedule?.daysOfWeek) ? schedule.daysOfWeek.filter((d) => DOW_VALUES.has(d)) : [];
  if (!days.length) return true;
  const date = fromLocalDateKey(dateKey);
  return days.includes(appDowFromDate(date));
}

function getDurationMinutes(goal, schedule) {
  const scheduleMinutes = schedule?.durationMinutes;
  if (Number.isFinite(scheduleMinutes) && scheduleMinutes > 0) return scheduleMinutes;
  const sessionMinutes = goal?.sessionMinutes;
  if (Number.isFinite(sessionMinutes) && sessionMinutes > 0) return sessionMinutes;
  return 30;
}

function occurrenceKey(goalId, dateKey, start) {
  return `${goalId}::${dateKey}::${start}`;
}

function isValidStart(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{2}:\d{2}$/.test(raw);
}

function resolveOccurrenceSlotKey(occ) {
  const raw = typeof occ?.start === "string" ? occ.start : occ?.slotKey;
  return isValidStart(raw) ? raw : "";
}

function resolveConflictNearest(occurrences, dateKey, start, durationMinutes, timeSlots = []) {
  const date = normalizeLocalDateKey(dateKey);
  const safeStart = start || "09:00";
  if (!date) return { start: safeStart, conflict: true };
  const preferredMin = parseTimeToMinutes(safeStart);
  if (!Number.isFinite(preferredMin)) return { start: safeStart, conflict: true };

  const dayOccurrences = Array.isArray(occurrences)
    ? occurrences.filter((o) => o && o.date === date)
    : [];
  const taken = dayOccurrences.map((o) => ({
    startMin: parseTimeToMinutes(o.start),
    duration: Number.isFinite(o.durationMinutes) ? o.durationMinutes : 0,
  }));

  const isFree = (candidateMin) =>
    !taken.some((o) => overlaps(candidateMin, durationMinutes, o.startMin, o.duration));

  if (isFree(preferredMin)) return { start: safeStart, conflict: false };

  if (Array.isArray(timeSlots) && timeSlots.length) {
    let best = null;
    for (const slot of timeSlots) {
      const slotMin = parseTimeToMinutes(slot);
      if (!Number.isFinite(slotMin)) continue;
      if (!isFree(slotMin)) continue;
      const distance = Math.abs(slotMin - preferredMin);
      if (!best || distance < best.distance || (distance === best.distance && slotMin > best.slotMin)) {
        best = { slotMin, distance };
      }
    }
    if (best) return { start: minutesToTime(best.slotMin), conflict: false };
    return { start: safeStart, conflict: true };
  }

  const bounds = { min: 5 * 60, max: 22 * 60 };
  const maxDistance = Math.max(preferredMin - bounds.min, bounds.max - preferredMin);
  for (let distance = 15; distance <= maxDistance; distance += 15) {
    const later = preferredMin + distance;
    if (later <= bounds.max && isFree(later)) {
      return { start: minutesToTime(later), conflict: false };
    }
    const earlier = preferredMin - distance;
    if (earlier >= bounds.min && isFree(earlier)) {
      return { start: minutesToTime(earlier), conflict: false };
    }
  }

  return { start: safeStart, conflict: true };
}

function buildWindowDates(fromDateKey, days) {
  const startKey = normalizeLocalDateKey(fromDateKey) || todayLocalKey();
  const start = fromLocalDateKey(startKey);
  const count = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14;
  const dates = [];
  for (let i = 0; i < count; i += 1) {
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + i);
    dates.push(toLocalDateKey(cursor));
  }
  return dates;
}

function getGoalById(data, goalId) {
  const list = Array.isArray(data?.goals) ? data.goals : [];
  return list.find((g) => g && g.id === goalId) || null;
}

export function dedupeOccurrences(occurrences) {
  const list = Array.isArray(occurrences) ? occurrences : [];
  const seen = new Map();
  const next = [];

  for (const occ of list) {
    if (!occ || !occ.goalId || !occ.date || !occ.start) {
      next.push(occ);
      continue;
    }
    const slotKey = resolveOccurrenceSlotKey(occ) || occ.start;
    const key = occurrenceKey(occ.goalId, occ.date, slotKey);
    if (!seen.has(key)) {
      seen.set(key, next.length);
      next.push(occ);
      continue;
    }
    const idx = seen.get(key);
    const existing = next[idx];
    const rankExisting = STATUS_RANK[existing?.status] || 0;
    const rankNext = STATUS_RANK[occ?.status] || 0;
    if (rankNext > rankExisting) next[idx] = occ;
  }

  return next;
}

export function ensureWindowForGoal(data, goalId, fromDateKey, days = 14) {
  const goal = getGoalById(data, goalId);
  if (!goal) return data;
  if (resolveGoalType(goal) !== "PROCESS") return data;

  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const slotKeys = resolveGoalSlots(goal, schedule);
  const timeSlots = slotKeys.length ? slotKeys : resolveGoalTimeSlots(goal, schedule);
  const { slot: fallbackSlot, fromStartAt } = resolveFallbackSlot(goal);
  const oneOff = normalizeLocalDateKey(goal?.oneOffDate);
  if (!oneOff && !timeSlots.length && !fromStartAt) return data;

  const dates = buildWindowDates(fromDateKey, days);
  const dateSet = new Set(dates);
  let occurrences = Array.isArray(data?.occurrences) ? data.occurrences.slice() : [];

  if (resolveTimeMode(goal) === "SLOTS" && slotKeys.length) {
    const allowed = new Set(slotKeys);
    occurrences = occurrences.filter((o) => {
      if (!o || o.goalId !== goal.id) return true;
      if (!dateSet.has(o.date)) return true;
      const occSlot = isValidStart(o.start) ? o.start : resolveOccurrenceSlotKey(o);
      return occSlot && allowed.has(occSlot);
    });
  }

  const usedKeys = new Set(
    occurrences
      .filter((o) => o && o.goalId && o.date && o.start)
      .map((o) => {
        const startKey = isValidStart(o.start) ? o.start : resolveOccurrenceSlotKey(o);
        return occurrenceKey(o.goalId, o.date, startKey);
      })
  );

  for (const dateKey of dates) {
    if (!shouldOccurOnDate(goal, dateKey, schedule)) continue;
    const durationMinutes = getDurationMinutes(goal, schedule);

    const slotsForDate = timeSlots.length ? timeSlots : [fallbackSlot];
    const isAnytimeSlot = slotsForDate.length === 1 && slotsForDate[0] === "00:00";
    for (const preferredStart of slotsForDate) {
      const resolved = isAnytimeSlot && preferredStart === "00:00"
        ? { start: preferredStart, conflict: false }
        : resolveConflictNearest(occurrences, dateKey, preferredStart, durationMinutes, slotsForDate);
      const finalStart = isValidStart(resolved.start) ? resolved.start : fallbackSlot;
      if (!finalStart) continue;
      const key = occurrenceKey(goal.id, dateKey, finalStart);
      if (usedKeys.has(key)) continue;

      const occurrence = {
        id: uid(),
        goalId: goal.id,
        date: dateKey,
        start: finalStart,
        slotKey: finalStart,
        durationMinutes,
        status: "planned",
      };
      if (resolved.conflict) occurrence.conflict = true;
      occurrences.push(occurrence);
      usedKeys.add(key);
    }
  }

  const nextOccurrences = dedupeOccurrences(occurrences);
  return { ...data, occurrences: nextOccurrences };
}

export function ensureWindowForGoals(data, goalIds, fromDateKey, days = 14) {
  const ids = Array.isArray(goalIds) ? goalIds : [];
  let next = data;
  for (const goalId of ids) {
    next = ensureWindowForGoal(next, goalId, fromDateKey, days);
  }
  return next;
}

export function regenerateWindowForGoal(data, goalId, fromDateKey, days = 14) {
  const goal = getGoalById(data, goalId);
  if (!goal) return data;
  if (resolveGoalType(goal) !== "PROCESS") return data;

  const startKey = normalizeLocalDateKey(fromDateKey) || todayLocalKey();
  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const pruned = occurrences.filter((o) => !(o && o.goalId === goalId && o.date >= startKey));
  const nextData = { ...data, occurrences: pruned };
  return ensureWindowForGoal(nextData, goalId, startKey, days);
}

export { resolveConflictNearest };

export function validateOccurrences(data) {
  const list = Array.isArray(data?.occurrences) ? data.occurrences : null;
  if (!list) {
    console.warn("occurrences should be an array", data?.occurrences);
    return;
  }
  const seen = new Set();
  for (const occ of list) {
    if (!occ || typeof occ !== "object") continue;
    const goalId = typeof occ.goalId === "string" ? occ.goalId.trim() : "";
    const date = normalizeLocalDateKey(occ.date);
    const start = typeof occ.start === "string" ? occ.start.trim() : "";
    console.assert(goalId, "occurrence missing goalId", occ);
    console.assert(date, "occurrence missing/invalid date", occ);
    console.assert(start, "occurrence missing start", occ);
    if (start) console.assert(isValidStart(start), "occurrence invalid start", occ);
    if (occ.conflict === true) console.assert(isValidStart(start), "conflict occurrence invalid start", occ);
    const key = `${goalId}::${date}::${start}`;
    if (goalId && date && start) {
      if (seen.has(key)) console.warn("duplicate occurrence", occ);
      else seen.add(key);
    }
  }
}

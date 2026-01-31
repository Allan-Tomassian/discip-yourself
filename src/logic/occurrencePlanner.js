import { uid as uidFn } from "../utils/helpers";
import {
  fromLocalDateKey,
  normalizeLocalDateKey,
  todayLocalKey,
  toLocalDateKey,
} from "../utils/dateKey";
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

function normalizeDateKeyLoose(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return normalizeLocalDateKey(raw) || "";
}

function addDaysDateKey(dateKey, days) {
  const k = normalizeDateKeyLoose(dateKey);
  if (!k) return "";
  const base = new Date(`${k}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + (Number.isFinite(days) ? Math.trunc(days) : 0));
  return toLocalDateKey(base);
}

function clampPeriod(fromKey, toKey) {
  const from = normalizeDateKeyLoose(fromKey);
  const to = normalizeDateKeyLoose(toKey);
  if (!from && !to) return { from: "", to: "" };
  if (from && to && to < from) return { from, to: from };
  return { from: from || "", to: to || "" };
}

function resolveActivePeriod(goal) {
  // Period is mandatory for PROCESS goals (enforced in state.js), but we keep safe fallbacks.
  const planType = typeof goal?.planType === "string" ? goal.planType.trim().toUpperCase() : "";

  // ONE_OFF: period is the oneOffDate.
  const oneOff = normalizeDateKeyLoose(goal?.oneOffDate);
  if (planType === "ONE_OFF" && oneOff) return { from: oneOff, to: oneOff };

  const { from, to } = clampPeriod(goal?.activeFrom, goal?.activeTo);
  if (from && to) return { from, to };

  // Legacy: if only from exists, default to 30-day window.
  if (from && !to) return { from, to: addDaysDateKey(from, 29) };

  // Last resort: today + 30 days.
  const today = todayLocalKey();
  return { from: today, to: addDaysDateKey(today, 29) };
}

function isDateWithinPeriod(dateKey, period) {
  const k = normalizeDateKeyLoose(dateKey);
  if (!k) return false;
  const from = normalizeDateKeyLoose(period?.from);
  const to = normalizeDateKeyLoose(period?.to);
  if (from && k < from) return false;
  if (to && k > to) return false;
  return true;
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


function resolvePlanningMode(goal, schedule) {
  const rawGoal = typeof goal?.planningMode === "string" ? goal.planningMode : "";
  const rawSchedule = typeof schedule?.planningMode === "string" ? schedule.planningMode : "";
  const raw = (rawGoal || rawSchedule || "").trim().toUpperCase();
  return raw;
}

function resolveTimeMode(goal, schedule) {
  const raw = typeof goal?.timeMode === "string" ? goal.timeMode.trim().toUpperCase() : "";
  if (raw) return raw;

  const pm = resolvePlanningMode(goal, schedule);
  if (pm === "DAY_SLOTS" || pm === "NO_TIME") return "NONE";

  if (pm === "UNIFORM_TIME" || pm === "ONE_OFF") {
    const slots = normalizeTimeSlots(goal?.timeSlots);
    const start = minutesToTime(parseTimeToMinutes(goal?.startTime));
    const any = slots[0] || start;
    return any ? "FIXED" : "NONE";
  }

  return "";
}

function resolveScheduleMode(goal, schedule) {
  const rawGoal = typeof goal?.scheduleMode === "string" ? goal.scheduleMode : "";
  const rawSchedule = typeof schedule?.scheduleMode === "string" ? schedule.scheduleMode : "";
  const raw = (rawGoal || rawSchedule || "").trim().toUpperCase();
  if (raw) return raw;

  const pm = resolvePlanningMode(goal, schedule);
  if (pm === "DAY_SLOTS") return "WEEKLY_SLOTS";

  return "";
}

/**
 * Canonical planning model (current UX):
 * - ONE_OFF: oneOffDate (required), time optional
 * - RECURRING: daysOfWeek (required), time optional, can use weeklySlotsByDay for per-day slots
 * - ANYTIME: daysOfWeek optional, or anytimeFlexible=true (never due)
 * - planningMode (ONE_OFF | UNIFORM_TIME | DAY_SLOTS | NO_TIME) is accepted as a fallback when scheduleMode/timeMode are missing.
 */

function resolveDueDays(goal, schedule) {
  // Canonical: prefer goal.daysOfWeek, then schedule.daysOfWeek
  const raw = Array.isArray(goal?.daysOfWeek)
    ? goal.daysOfWeek
    : Array.isArray(schedule?.daysOfWeek)
      ? schedule.daysOfWeek
      : [];

  const normalized = Array.isArray(raw) ? raw.filter((d) => DOW_VALUES.has(d)) : [];
  if (normalized.length) return normalized;

  // Legacy support: repeat=daily means every day
  const rep = typeof goal?.repeat === "string" ? goal.repeat.trim().toLowerCase() : "";
  if (rep === "daily") return [1, 2, 3, 4, 5, 6, 7];

  return [];
}

function isAnytimeFlexible(goal, schedule) {
  const raw = goal?.anytimeFlexible;
  if (typeof raw === "boolean") return raw;
  const raw2 = schedule?.anytimeFlexible;
  if (typeof raw2 === "boolean") return raw2;
  return false;
}

function parseSlotRange(raw) {
  // Accept: "HH:MM-HH:MM" or {start,end} or {startTime,endTime}
  if (typeof raw === "string") {
    const s = raw.trim();
    const m = s.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
    if (!m) return null;
    const start = minutesToTime(parseTimeToMinutes(m[1]));
    const end = minutesToTime(parseTimeToMinutes(m[2]));
    if (!start || !end) return null;
    return { start, end };
  }
  if (raw && typeof raw === "object") {
    const startRaw =
      typeof raw.start === "string" ? raw.start : typeof raw.startTime === "string" ? raw.startTime : "";
    const endRaw =
      typeof raw.end === "string" ? raw.end : typeof raw.endTime === "string" ? raw.endTime : "";
    const start = minutesToTime(parseTimeToMinutes(startRaw));
    const end = minutesToTime(parseTimeToMinutes(endRaw));
    if (!start) return null;
    return end ? { start, end } : { start, end: "" };
  }
  return null;
}

function normalizeSlotRanges(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const slot = parseSlotRange(item);
    if (!slot || !slot.start) continue;
    const key = `${slot.start}::${slot.end || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
  }
  return out;
}

function resolveWeeklySlotsByDay(goal, schedule) {
  // Canonical: weeklySlotsByDay only (daySlotsByDay deprecated and migrated away)
  const raw = goal?.weeklySlotsByDay || schedule?.weeklySlotsByDay;
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const k of Object.keys(raw)) {
    const day = Number(k);
    if (!DOW_VALUES.has(day)) continue;
    out[day] = normalizeSlotRanges(raw[k]);
  }
  return out;
}

function resolveGoalSlots(goal, schedule) {
  const mode = resolveTimeMode(goal, schedule);
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

function resolvePlannedSlotsForDate(goal, dateKey, schedule) {
  const scheduleMode = resolveScheduleMode(goal, schedule);
  const timeMode = resolveTimeMode(goal, schedule);

  const pm = resolvePlanningMode(goal, schedule);
  const forceWeeklySlots = pm === "DAY_SLOTS";
  const forceNoTime = pm === "NO_TIME";

  const weekly = resolveWeeklySlotsByDay(goal, schedule);
  const hasWeekly = Boolean(weekly && Object.keys(weekly).length);

  // Per-day slots (different hours per day)
  if (scheduleMode === "WEEKLY_SLOTS" || hasWeekly || forceWeeklySlots) {
    const date = fromLocalDateKey(dateKey);
    const dow = appDowFromDate(date);
    const daySlots = weekly?.[dow] || [];
    // If the user selected a day but provided no slot ranges for that day, we still create a NO_TIME placeholder.
    return daySlots.length ? daySlots : [{ start: "00:00", end: "", noTime: true }];
  }

  // timeMode NONE (or no explicit time) => NO_TIME placeholder
  if (timeMode === "NONE" || forceNoTime) return [{ start: "00:00", end: "", noTime: true }];

  // Canonical slots for uniform planning
  const slotKeys = resolveGoalSlots(goal, schedule);

  // SLOTS: generate one occurrence per slot
  if (timeMode === "SLOTS") {
    const slots = Array.isArray(slotKeys) ? slotKeys.filter((s) => isValidStart(s)) : [];
    if (!slots.length) return [{ start: "00:00", end: "", noTime: true }];
    return slots.map((s) => ({ start: s, end: "" }));
  }

  // FIXED: single time for all due days
  if (timeMode === "FIXED") {
    const start = (slotKeys && slotKeys[0]) || minutesToTime(parseTimeToMinutes(goal?.startTime)) || "";
    if (!start) return [{ start: "00:00", end: "", noTime: true }];
    return [{ start, end: "" }];
  }

  // Legacy fallback: if multiple slots exist, treat as SLOTS; otherwise single.
  const legacySlots = Array.isArray(slotKeys) ? slotKeys.filter((s) => isValidStart(s)) : [];
  if (legacySlots.length > 1) return legacySlots.map((s) => ({ start: s, end: "" }));
  const legacyStart =
    legacySlots[0] ||
    minutesToTime(parseTimeToMinutes(goal?.startTime)) ||
    (resolveGoalTimeSlots(goal, schedule)[0] || "");

  if (!legacyStart) return [{ start: "00:00", end: "", noTime: true }];
  return [{ start: legacyStart, end: "" }];
}

function getDurationMinutes(goal, schedule) {
  const scheduleMinutes = schedule?.durationMinutes;
  if (Number.isFinite(scheduleMinutes) && scheduleMinutes > 0) return scheduleMinutes;
  const sessionMinutes = goal?.sessionMinutes;
  if (Number.isFinite(sessionMinutes) && sessionMinutes > 0) return sessionMinutes;
  return 30;
}

function getDurationMinutesForSlot(goal, schedule, slot) {
  if (slot?.noTime === true) return 0;

  const startMin = parseTimeToMinutes(slot?.start);
  const endMin = parseTimeToMinutes(slot?.end);
  if (Number.isFinite(startMin) && Number.isFinite(endMin)) {
    const d = endMin - startMin;
    if (d > 0) return d;
  }
  return getDurationMinutes(goal, schedule);
}

function resolveConflictExact(occurrences, dateKey, start, durationMinutes) {
  const date = normalizeLocalDateKey(dateKey);
  const safeStart = start || "09:00";
  if (!date) return { start: safeStart, conflict: true };
  const preferredMin = parseTimeToMinutes(safeStart);
  if (!Number.isFinite(preferredMin)) return { start: safeStart, conflict: true };

  const dayOccurrences = Array.isArray(occurrences) ? occurrences.filter((o) => o && o.date === date) : [];
  const taken = dayOccurrences.map((o) => ({
    startMin: parseTimeToMinutes(o.start),
    duration: Number.isFinite(o.durationMinutes) ? o.durationMinutes : 0,
  }));

  const isFree = (candidateMin) =>
    !taken.some((o) => overlaps(candidateMin, durationMinutes, o.startMin, o.duration));

  return isFree(preferredMin) ? { start: safeStart, conflict: false } : { start: safeStart, conflict: true };
}

function shouldOccurOnDate(goal, dateKey, schedule) {
  const period = resolveActivePeriod(goal);
  if (!isDateWithinPeriod(dateKey, period)) return false;

  const oneOff = normalizeLocalDateKey(goal?.oneOffDate);
  if (oneOff) return oneOff === dateKey;

  // Flexible anytime => NEVER due => no planned occurrences
  if (isAnytimeFlexible(goal, schedule)) return false;

  const dueDays = resolveDueDays(goal, schedule);

  // If no due days, do not generate occurrences by default.
  if (!dueDays.length) {
    const rep = typeof goal?.repeat === "string" ? goal.repeat.trim().toLowerCase() : "";
    if (rep === "daily") return true;
    return false;
  }

  const date = fromLocalDateKey(dateKey);
  return dueDays.includes(appDowFromDate(date));
}

function occurrenceKey(goalId, dateKey, start) {
  return `${goalId}::${dateKey}::${start}`;
}

function isValidStart(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{2}:\d{2}$/.test(raw);
}

function resolveOccurrenceSlotKey(occ) {
  const raw = typeof occ?.slotKey === "string" ? occ.slotKey : typeof occ?.start === "string" ? occ.start : "";
  return isValidStart(raw) ? raw : "";
}

function resolveConflictNearest(occurrences, dateKey, start, durationMinutes, timeSlots = []) {
  const date = normalizeLocalDateKey(dateKey);
  const safeStart = start || "09:00";
  if (!date) return { start: safeStart, conflict: true };
  const preferredMin = parseTimeToMinutes(safeStart);
  if (!Number.isFinite(preferredMin)) return { start: safeStart, conflict: true };

  const dayOccurrences = Array.isArray(occurrences) ? occurrences.filter((o) => o && o.date === date) : [];
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
  const scheduleMode = resolveScheduleMode(goal, schedule);

  const { slot: fallbackSlot, fromStartAt } = resolveFallbackSlot(goal);
  const oneOff = normalizeLocalDateKey(goal?.oneOffDate);

  const weekly = resolveWeeklySlotsByDay(goal, schedule);
  const hasWeekly = Boolean(weekly && Object.keys(weekly).length);

  const flexibleAnytime = isAnytimeFlexible(goal, schedule);
  const dueDays = resolveDueDays(goal, schedule);

  if (flexibleAnytime) return data;

  const wantsPlannedOccurrences = Boolean(oneOff) || dueDays.length > 0;

  // Backward compatibility: if nothing indicates any planning intent, do nothing.
  if (!wantsPlannedOccurrences && !hasWeekly && !fromStartAt) {
    const legacySlots = resolveGoalSlots(goal, schedule);
    const legacyTimeSlots = legacySlots.length ? legacySlots : resolveGoalTimeSlots(goal, schedule);
    const rep = typeof goal?.repeat === "string" ? goal.repeat.trim().toLowerCase() : "";
    const legacyRepeatWants = rep === "daily" || rep === "weekly";
    if (!legacyRepeatWants && !legacyTimeSlots.length) return data;
  }

  const period = resolveActivePeriod(goal);
  const dates = buildWindowDates(fromDateKey, days).filter((k) => isDateWithinPeriod(k, period));
  const dateSet = new Set(dates);
  let occurrences = Array.isArray(data?.occurrences) ? data.occurrences.slice() : [];

  // Period enforcement: remove occurrences for this goal that fall outside its active period.
  // We only touch occurrences for this goal, and only within the managed date window.
  occurrences = occurrences.filter((o) => {
    if (!o || o.goalId !== goal.id) return true;
    if (!dateSet.has(o.date)) return true;
    return isDateWithinPeriod(o.date, period);
  });

  if (!dates.length) {
    const nextOccurrences = dedupeOccurrences(occurrences);
    return { ...data, occurrences: nextOccurrences };
  }

  // Only prune when legacy SLOTS are the intended mode (uniform time slots), not for NO_TIME/DAY_SLOTS.
  const legacySlotKeys = resolveGoalSlots(goal, schedule);
  if (
    resolveTimeMode(goal, schedule) === "SLOTS" &&
    legacySlotKeys.length
  ) {
    const allowed = new Set(legacySlotKeys);
    occurrences = occurrences.filter((o) => {
      if (!o || o.goalId !== goal.id) return true;
      if (!dateSet.has(o.date)) return true;
      const occSlot = resolveOccurrenceSlotKey(o) || (isValidStart(o.start) ? o.start : "");
      return occSlot && allowed.has(occSlot);
    });
  }

  const usedKeys = new Set(
    occurrences
      .filter((o) => o && o.goalId && o.date && o.start)
      .map((o) => {
        const startKey = resolveOccurrenceSlotKey(o) || (isValidStart(o.start) ? o.start : "");
        return occurrenceKey(o.goalId, o.date, startKey);
      })
  );

  for (const dateKey of dates) {
    if (!shouldOccurOnDate(goal, dateKey, schedule)) continue;

    const plannedSlots = resolvePlannedSlotsForDate(goal, dateKey, schedule);
    const slotsForDate = plannedSlots.length ? plannedSlots : [{ start: fallbackSlot, end: "" }];

    // Scheduled times should not auto-move. Conflicts are marked, not shifted.
    const plannedMode = resolveScheduleMode(goal, schedule);
    const tm = resolveTimeMode(goal, schedule);
    const useExactTimes =
      plannedMode === "WEEKLY_SLOTS" ||
      Boolean(weekly) ||
      tm === "FIXED" ||
      tm === "SLOTS";

    for (const slot of slotsForDate) {
      const preferredStart = slot?.start;
      if (!isValidStart(preferredStart)) continue;

      const isNoTime = slot?.noTime === true;
      const durationMinutes = getDurationMinutesForSlot(goal, schedule, slot);

      const candidateStarts = slotsForDate
        .map((s) => (typeof s?.start === "string" ? s.start.trim() : ""))
        .filter((s) => isValidStart(s) && s !== "00:00");

      const resolved = isNoTime
        ? { start: preferredStart, conflict: false }
        : useExactTimes
          ? resolveConflictExact(occurrences, dateKey, preferredStart, durationMinutes)
          : resolveConflictNearest(occurrences, dateKey, preferredStart, durationMinutes, candidateStarts);

      const finalStart = isValidStart(resolved.start) ? resolved.start : preferredStart;
      const key = occurrenceKey(goal.id, dateKey, finalStart);
      if (usedKeys.has(key)) continue;

      const occurrence = {
        id: uidFn(),
        goalId: goal.id,
        date: dateKey,
        start: finalStart,
        slotKey: finalStart,
        durationMinutes,
        status: "planned",
      };

      if (isNoTime) {
        occurrence.noTime = true;
      }

      if (slot?.end && isValidStart(slot.end)) occurrence.end = slot.end;
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
    console.assert(start, "occurrence missing start (start is required for planned slots)", occ);
    if (start) console.assert(isValidStart(start), "occurrence invalid start", occ);
    if (occ.conflict === true) console.assert(isValidStart(start), "conflict occurrence invalid start", occ);
    const key = `${goalId}::${date}::${start}`;
    if (goalId && date && start) {
      if (seen.has(key)) console.warn("duplicate occurrence", occ);
      else seen.add(key);
    }
  }
}
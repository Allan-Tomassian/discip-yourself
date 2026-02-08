import { uid as uidFn } from "../utils/helpers";
import {
  addDaysLocal,
  appDowFromDate,
  buildDateRangeLocalKeys,
  fromLocalDateKey,
  minutesToTimeStr,
  normalizeLocalDateKey,
  parseTimeToMinutes,
  isValidTimeStr,
  todayLocalKey,
  toLocalDateKey,
} from "../utils/datetime";
import { resolveGoalType } from "../domain/goalType";
import { ensureScheduleRulesForActions } from "./scheduleRules";

// P0.4 single source of truth: planned occurrences generation only here.
// Example: const next = ensureWindowForGoal(state, goalId, todayLocalKey(), 14);
// Example: const next = regenerateWindowForGoal(state, goalId, todayLocalKey(), 14);

const STATUS_RANK = { done: 3, planned: 2, skipped: 1 };
const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]); // 1=Mon .. 7=Sun (app convention)

function normalizeDateKeyLoose(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return normalizeLocalDateKey(raw) || "";
}

function addDaysDateKey(dateKey, days) {
  return addDaysLocal(dateKey, days);
}

function clampPeriod(fromKey, toKey) {
  const from = normalizeDateKeyLoose(fromKey);
  const to = normalizeDateKeyLoose(toKey);
  if (!from && !to) return { from: "", to: "" };
  if (from && to && to < from) return { from, to: from };
  return { from: from || "", to: to || "" };
}

function formatLocalDateTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function parseLocalDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  )
    return null;
  const d = new Date(year, month - 1, day, hour, minute, second, 0);
  const ts = d.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function addMinutesLocal(dateKey, timeHM, minutes) {
  const date = normalizeLocalDateKey(dateKey);
  if (!date) return "";
  const minutesStart = parseTimeToMinutes(timeHM);
  if (!Number.isFinite(minutesStart)) return "";
  const base = fromLocalDateKey(date);
  base.setHours(Math.floor(minutesStart / 60), minutesStart % 60, 0, 0);
  const mins = Number.isFinite(minutes) ? Math.round(minutes) : 0;
  base.setMinutes(base.getMinutes() + mins);
  return formatLocalDateTime(base);
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

const minutesToTime = minutesToTimeStr;

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
  return isValidTimeStr(raw);
}

function isSameOccurrenceArray(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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

function resolveWindowRange(fromKey, toKey, now = new Date()) {
  const today = toLocalDateKey(now);
  const fallbackFrom = addDaysDateKey(today, -7);
  const fallbackTo = addDaysDateKey(today, 14);
  const from = normalizeDateKeyLoose(fromKey) || fallbackFrom;
  const to = normalizeDateKeyLoose(toKey) || fallbackTo;
  const clamped = clampPeriod(from, to);
  return { from: clamped.from || fallbackFrom, to: clamped.to || fallbackTo };
}

function getGoalById(data, goalId) {
  const list = Array.isArray(data?.goals) ? data.goals : [];
  return list.find((g) => g && g.id === goalId) || null;
}

function extractTimeFromLocalDateTime(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function normalizeDurationMinutesValue(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function classifyOccurrencePriority(occ) {
  if (!occ || typeof occ !== "object") return "window";
  const timeType = occ.timeType === "fixed" ? "fixed" : occ.timeType === "window" ? "window" : "";
  if (timeType === "fixed") return "fixed";
  const hasWindowBounds = Boolean(occ.windowStartAt || occ.windowEndAt);
  if ((occ.noTime === true || occ.start === "00:00") && !hasWindowBounds) return "anytime";
  if (timeType === "window") return "window";
  if (occ.noTime === true || occ.start === "00:00") return "window";
  return "fixed";
}

function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || !intervals.length) return [];
  const sorted = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return [];
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function findPlacementWithinWindow(windowStart, windowEnd, duration, occupied) {
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) return null;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (windowEnd <= windowStart) return null;
  const intervals = mergeIntervals(occupied);
  let cursor = windowStart;
  for (const block of intervals) {
    if (cursor + duration <= block.start) return cursor;
    if (block.end > cursor) cursor = block.end;
    if (cursor + duration > windowEnd) return null;
  }
  return cursor + duration <= windowEnd ? cursor : null;
}

export function resolveWindowConflictsForDay(occurrences, dateKey) {
  const list = Array.isArray(occurrences) ? occurrences : [];
  const targetDate = normalizeLocalDateKey(dateKey);
  if (!targetDate || !list.length) return occurrences;

  const planned = [];
  for (let i = 0; i < list.length; i += 1) {
    const occ = list[i];
    if (!occ || typeof occ !== "object") continue;
    const date = normalizeLocalDateKey(occ.date);
    if (date !== targetDate) continue;
    const status = typeof occ.status === "string" ? occ.status : "planned";
    if (status !== "planned") continue;
    planned.push({ occ, index: i });
  }

  if (!planned.length) return occurrences;

  const fixedIntervals = [];
  const windowItems = [];

  for (const item of planned) {
    const occ = item.occ;
    const priority = classifyOccurrencePriority(occ);
    if (priority === "fixed") {
      const startMin = parseTimeToMinutes(occ.start);
      const duration = normalizeDurationMinutesValue(occ.durationMinutes) || 0;
      if (Number.isFinite(startMin) && duration > 0) {
        fixedIntervals.push({ start: startMin, end: startMin + duration });
      }
    } else if (priority === "window") {
      const duration = normalizeDurationMinutesValue(occ.durationMinutes);
      const windowStartAt = extractTimeFromLocalDateTime(occ.windowStartAt);
      const windowEndAt = extractTimeFromLocalDateTime(occ.windowEndAt);
      const windowStart = parseTimeToMinutes(windowStartAt);
      const windowEnd = parseTimeToMinutes(windowEndAt);
      windowItems.push({
        occ,
        index: item.index,
        duration,
        windowStart,
        windowEnd,
      });
    }
  }

  if (!windowItems.length) return occurrences;

  const occupied = mergeIntervals(fixedIntervals);
  const sortedWindows = windowItems.slice().sort((a, b) => {
    if (a.windowStart !== b.windowStart) return a.windowStart - b.windowStart;
    const ida = typeof a.occ?.id === "string" ? a.occ.id : "";
    const idb = typeof b.occ?.id === "string" ? b.occ.id : "";
    return ida.localeCompare(idb);
  });

  let next = occurrences;
  let changed = false;

  for (const item of sortedWindows) {
    const occ = item.occ;
    const duration = item.duration;
    const canPlace =
      Number.isFinite(item.windowStart) &&
      Number.isFinite(item.windowEnd) &&
      Number.isFinite(duration) &&
      duration > 0;

    let resolvedStart = "";
    let resolvedStartAt = "";
    let conflict = true;

    if (canPlace) {
      const placement = findPlacementWithinWindow(item.windowStart, item.windowEnd, duration, occupied);
      if (Number.isFinite(placement)) {
        resolvedStart = minutesToTime(placement);
        resolvedStartAt = `${targetDate}T${resolvedStart}`;
        conflict = false;
        occupied.push({ start: placement, end: placement + duration });
      }
    }

    const patch = {};
    patch.resolvedStart = resolvedStart;
    patch.resolvedStartAt = resolvedStartAt;
    patch.conflict = conflict;

    const current = next[item.index];
    if (
      current?.resolvedStart === patch.resolvedStart &&
      current?.resolvedStartAt === patch.resolvedStartAt &&
      current?.conflict === patch.conflict
    ) {
      continue;
    }
    if (next === occurrences) next = occurrences.slice();
    next[item.index] = { ...current, ...patch };
    changed = true;
  }

  return changed ? next : occurrences;
}

function normalizeRuleTime(value, fallback = "") {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function resolveRuleDurationMinutes(rule) {
  const base = Number.isFinite(rule?.durationMin) && rule.durationMin > 0 ? Math.round(rule.durationMin) : null;
  if (base != null) return base;
  const start = parseTimeToMinutes(rule?.startTime);
  const end = parseTimeToMinutes(rule?.endTime);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.round(end - start);
  }
  return null;
}

function ruleAppliesOnDate(rule, dateKey) {
  if (!rule || !dateKey) return false;
  const date = normalizeLocalDateKey(dateKey);
  if (!date) return false;
  const kind = rule.kind === "one_time" ? "one_time" : "recurring";
  const startDate = normalizeDateKeyLoose(rule.startDate);
  const endDate = normalizeDateKeyLoose(rule.endDate);

  if (kind === "one_time") return Boolean(startDate && startDate === date);
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
  if (!days.length) return false;
  const dow = appDowFromDate(fromLocalDateKey(date));
  return days.includes(dow);
}

function buildOccurrenceFromRule(rule, dateKey) {
  const timeType = rule?.timeType === "window" ? "window" : "fixed";
  const durationMinutes = resolveRuleDurationMinutes(rule) ?? 0;
  const startTime = normalizeRuleTime(rule?.startTime);
  const endTime = normalizeRuleTime(rule?.endTime);
  const windowStart = normalizeRuleTime(rule?.windowStart, "00:00");
  const windowEnd = normalizeRuleTime(rule?.windowEnd, "23:59");

  if (timeType === "fixed" && !startTime) return null;

  const base = {
    id: uidFn(),
    goalId: rule.actionId,
    date: dateKey,
    start: timeType === "fixed" ? startTime : "00:00",
    slotKey: timeType === "fixed" ? startTime : "00:00",
    durationMinutes,
    status: "planned",
    scheduleRuleId: rule.id,
    timeType,
  };

  if (timeType === "fixed") {
    const startAt = startTime ? `${dateKey}T${startTime}` : "";
    const endAt = endTime ? `${dateKey}T${endTime}` : startTime && durationMinutes ? addMinutesLocal(dateKey, startTime, durationMinutes) : "";
    return {
      ...base,
      startAt,
      endAt,
    };
  }

  return {
    ...base,
    noTime: true,
    windowStartAt: `${dateKey}T${windowStart}`,
    windowEndAt: `${dateKey}T${windowEnd}`,
  };
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

  const prevOccurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
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
    if (isSameOccurrenceArray(prevOccurrences, nextOccurrences)) return data;
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
  if (isSameOccurrenceArray(prevOccurrences, nextOccurrences)) return data;
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

export function ensureWindowFromScheduleRules(data, fromKey, toKey, actionIds = null, now = new Date()) {
  if (!data || typeof data !== "object") return data;
  const ids = Array.isArray(actionIds) ? actionIds.filter(Boolean) : [];
  let working = data;
  if (ids.length) {
    const synced = ensureScheduleRulesForActions(working, ids, now);
    if (synced !== working) working = synced;
  }

  const rulesRaw = Array.isArray(working.scheduleRules) ? working.scheduleRules : [];
  const activeRules = rulesRaw.filter((r) => r && r.isActive !== false && r.id && r.actionId);
  const ruleList = ids.length ? activeRules.filter((r) => ids.includes(r.actionId)) : activeRules;
  if (!ruleList.length) return working;

  const { from, to } = resolveWindowRange(fromKey, toKey, now);
  const windowDates = buildDateRangeLocalKeys(from, to);
  if (!windowDates.length) return working;

  const windowSet = new Set(windowDates);
  const occurrences = Array.isArray(working.occurrences) ? working.occurrences : [];
  let nextOccurrences = occurrences;
  let changed = false;

  const byRuleDate = new Map();
  const legacyByKey = new Map();

  occurrences.forEach((occ, idx) => {
    if (!occ || typeof occ !== "object") return;
    const date = normalizeLocalDateKey(occ.date);
    if (!date || !windowSet.has(date)) return;
    const ruleId = typeof occ.scheduleRuleId === "string" ? occ.scheduleRuleId : "";
    if (ruleId) {
      const key = `${ruleId}::${date}`;
      if (!byRuleDate.has(key)) byRuleDate.set(key, idx);
      return;
    }
    const goalId = typeof occ.goalId === "string" ? occ.goalId : "";
    const start = typeof occ.start === "string" ? occ.start : "";
    if (!goalId || !start) return;
    const key = `${goalId}::${date}::${start}`;
    if (!legacyByKey.has(key)) legacyByKey.set(key, idx);
  });

  function applyPatch(idx, patch) {
    const current = nextOccurrences[idx];
    if (!current || typeof current !== "object") return false;
    let localChanged = false;
    const next = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === "undefined") continue;
      if (next[key] !== value) {
        next[key] = value;
        localChanged = true;
      }
    }
    if (!localChanged) return false;
    if (nextOccurrences === occurrences) nextOccurrences = occurrences.slice();
    nextOccurrences[idx] = next;
    changed = true;
    return true;
  }

  for (const rule of ruleList) {
    if (!rule || !rule.id || !rule.actionId) continue;
    const candidateDates = rule.kind === "one_time" ? [normalizeDateKeyLoose(rule.startDate)] : windowDates;
    for (const dateKey of candidateDates) {
      if (!dateKey || !windowSet.has(dateKey)) continue;
      if (!ruleAppliesOnDate(rule, dateKey)) continue;

      const ruleKey = `${rule.id}::${dateKey}`;
      if (byRuleDate.has(ruleKey)) {
        const idx = byRuleDate.get(ruleKey);
        const current = nextOccurrences[idx];
        const status = typeof current?.status === "string" ? current.status : "planned";
        if (status !== "planned") continue;
        const patch = {};
        patch.scheduleRuleId = rule.id;
        patch.timeType = rule.timeType === "window" ? "window" : "fixed";
        if (patch.timeType === "fixed") {
          const startTime = normalizeRuleTime(rule.startTime);
          if (startTime) {
            patch.start = startTime;
            patch.slotKey = startTime;
            const startAt = `${dateKey}T${startTime}`;
            patch.startAt = startAt;
            const durationMinutes = resolveRuleDurationMinutes(rule);
            const endTime = normalizeRuleTime(rule.endTime);
            const endAt = endTime
              ? `${dateKey}T${endTime}`
              : startTime && durationMinutes
                ? addMinutesLocal(dateKey, startTime, durationMinutes)
                : "";
            if (endAt) patch.endAt = endAt;
            if (Number.isFinite(durationMinutes)) {
              patch.durationMinutes = durationMinutes;
            }
          }
        } else {
          const windowStart = normalizeRuleTime(rule.windowStart, "00:00");
          const windowEnd = normalizeRuleTime(rule.windowEnd, "23:59");
          const windowStartAt = `${dateKey}T${windowStart}`;
          const windowEndAt = `${dateKey}T${windowEnd}`;
          patch.noTime = true;
          patch.start = "00:00";
          patch.slotKey = "00:00";
          patch.windowStartAt = windowStartAt;
          patch.windowEndAt = windowEndAt;
          const durationMinutes = resolveRuleDurationMinutes(rule);
          if (Number.isFinite(durationMinutes)) {
            patch.durationMinutes = durationMinutes;
          }
        }
        applyPatch(idx, patch);
        continue;
      }

      const matchStart =
        rule.timeType === "window"
          ? "00:00"
          : normalizeRuleTime(rule.startTime);
      if (matchStart) {
        const legacyKey = `${rule.actionId}::${dateKey}::${matchStart}`;
        const legacyIdx = legacyByKey.get(legacyKey);
        if (typeof legacyIdx === "number") {
          const current = nextOccurrences[legacyIdx];
          const status = typeof current?.status === "string" ? current.status : "planned";
          if (status !== "planned") {
            byRuleDate.set(ruleKey, legacyIdx);
            continue;
          }
          const patch = {};
          patch.scheduleRuleId = rule.id;
          patch.timeType = rule.timeType === "window" ? "window" : "fixed";
          if (patch.timeType === "fixed") {
            const startAt = `${dateKey}T${matchStart}`;
            const durationMinutes = resolveRuleDurationMinutes(rule);
            const endTime = normalizeRuleTime(rule.endTime);
            const endAt = endTime
              ? `${dateKey}T${endTime}`
              : matchStart && durationMinutes
                ? addMinutesLocal(dateKey, matchStart, durationMinutes)
                : "";
            patch.startAt = startAt;
            if (endAt) patch.endAt = endAt;
            if (Number.isFinite(durationMinutes)) {
              patch.durationMinutes = durationMinutes;
            }
          } else {
            const windowStart = normalizeRuleTime(rule.windowStart, "00:00");
            const windowEnd = normalizeRuleTime(rule.windowEnd, "23:59");
            const windowStartAt = `${dateKey}T${windowStart}`;
            const windowEndAt = `${dateKey}T${windowEnd}`;
            patch.noTime = true;
            patch.windowStartAt = windowStartAt;
            patch.windowEndAt = windowEndAt;
            const durationMinutes = resolveRuleDurationMinutes(rule);
            if (Number.isFinite(durationMinutes)) {
              patch.durationMinutes = durationMinutes;
            }
          }
          applyPatch(legacyIdx, patch);
          byRuleDate.set(ruleKey, legacyIdx);
          continue;
        }
      }

      const created = buildOccurrenceFromRule(rule, dateKey);
      if (!created) continue;
      if (nextOccurrences === occurrences) nextOccurrences = occurrences.slice();
      nextOccurrences.push(created);
      changed = true;
      byRuleDate.set(`${rule.id}::${dateKey}`, nextOccurrences.length - 1);
    }
  }

  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  for (let i = 0; i < nextOccurrences.length; i += 1) {
    const occ = nextOccurrences[i];
    if (!occ || typeof occ !== "object") continue;
    const date = normalizeLocalDateKey(occ.date);
    if (!date || !windowSet.has(date)) continue;
    const status = typeof occ.status === "string" ? occ.status : "planned";
    if (status !== "planned") continue;
    const timeType =
      occ.timeType === "window" || occ.noTime === true || typeof occ.windowEndAt === "string"
        ? "window"
        : "fixed";
    let endMs = null;
    if (timeType === "fixed") {
      const endAt = occ.endAt || occ.startAt || (occ.start ? `${date}T${occ.start}` : "");
      const endAtMs = parseLocalDateTime(endAt);
      if (endAtMs != null) endMs = endAtMs;
    } else {
      const windowEndAt = occ.windowEndAt || `${date}T23:59`;
      const windowEndMs = parseLocalDateTime(windowEndAt);
      if (windowEndMs != null) endMs = windowEndMs;
    }
    if (endMs == null || nowMs <= endMs) continue;
    const patch = { status: "missed", updatedAt: nowIso };
    applyPatch(i, patch);
  }

  let resolved = nextOccurrences;
  let placementChanged = false;
  for (const dateKey of windowDates) {
    const updated = resolveWindowConflictsForDay(resolved, dateKey);
    if (updated !== resolved) {
      resolved = updated;
      placementChanged = true;
    }
  }
  if (placementChanged) {
    nextOccurrences = resolved;
    changed = true;
  }

  if (!changed) return working;
  return { ...working, occurrences: nextOccurrences };
}

export function regenerateWindowFromScheduleRules(data, actionId, fromKey, toKey, now = new Date()) {
  if (!data || !actionId) return data;
  const dateRange = resolveWindowRange(fromKey, toKey, now);
  const windowDates = buildDateRangeLocalKeys(dateRange.from, dateRange.to);
  if (!windowDates.length) return data;
  const windowSet = new Set(windowDates);

  const occurrences = Array.isArray(data.occurrences) ? data.occurrences : [];
  const filtered = occurrences.filter((occ) => {
    if (!occ || occ.goalId !== actionId) return true;
    const date = normalizeLocalDateKey(occ.date);
    if (!date || !windowSet.has(date)) return true;
    return occ.status && occ.status !== "planned";
  });

  if (filtered.length === occurrences.length) {
    return ensureWindowFromScheduleRules(data, dateRange.from, dateRange.to, [actionId], now);
  }
  const next = { ...data, occurrences: filtered };
  return ensureWindowFromScheduleRules(next, dateRange.from, dateRange.to, [actionId], now);
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

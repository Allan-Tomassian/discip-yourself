import { addDaysLocal, fromLocalDateKey, getWeekdayShortLabel, normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";
import { EXECUTION_SURFACE_STATUS, deriveExecutionStatus } from "../logic/executionStatus";
import { TIMELINE_SCREEN_COPY } from "../ui/labels";

function isFixedMidnight({ occurrence = null, goal = null } = {}) {
  if (occurrence?.timeMode === "FIXED" || occurrence?.fixedTime === true || occurrence?.isFixedTime === true) return true;
  const goalTimeMode = String(goal?.timeMode || goal?.schedule?.timeMode || "").trim().toUpperCase();
  const goalStart = String(goal?.startTime || goal?.schedule?.startTime || "").trim();
  const goalSlots = [
    ...(Array.isArray(goal?.timeSlots) ? goal.timeSlots : []),
    ...(Array.isArray(goal?.schedule?.timeSlots) ? goal.schedule.timeSlots : []),
  ].map((slot) => String(slot || "").trim());
  return goalTimeMode === "FIXED" && (goalStart === "00:00" || goalSlots.includes("00:00"));
}

export function getTimelineDisplayTime({ startTime = "", occurrence = null, goal = null } = {}) {
  const raw = String(startTime || occurrence?.start || occurrence?.slotKey || "").trim();
  if (!raw) return "À planifier";
  if (raw === "00:00") {
    if (occurrence?.noTime === true) return "À planifier";
    if (!isFixedMidnight({ occurrence, goal })) return "À planifier";
  }
  return raw;
}

export function buildTimelineDateStrip(selectedDateKey, todayKey) {
  const anchor = normalizeLocalDateKey(selectedDateKey) || normalizeLocalDateKey(todayKey) || todayLocalKey();
  const today = normalizeLocalDateKey(todayKey);
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDaysLocal(anchor, index - 3);
    const date = fromLocalDateKey(dateKey);
    return {
      dateKey,
      weekday: getWeekdayShortLabel(date, "fr-FR").toUpperCase(),
      dayNumber: String(date.getDate()),
      isSelected: dateKey === anchor,
      isToday: today ? dateKey === today : false,
    };
  });
}

export function resolveTimelineExecutionStatus({
  occurrence = null,
  activeSession = null,
  activeOccurrenceId = null,
  sessionHistory = [],
  dateKey = "",
} = {}) {
  const occurrenceId = typeof occurrence?.id === "string" ? occurrence.id.trim() : "";
  if (activeOccurrenceId && occurrenceId && activeOccurrenceId === occurrenceId) {
    return EXECUTION_SURFACE_STATUS.ACTIVE;
  }
  return deriveExecutionStatus({
    occurrence,
    activeSession,
    sessionHistory,
    dateKey: dateKey || occurrence?.date,
  }).status;
}

export function getTimelineStatusLabel(status) {
  if (status === EXECUTION_SURFACE_STATUS.DONE) return TIMELINE_SCREEN_COPY.completed;
  if (status === EXECUTION_SURFACE_STATUS.ACTIVE || status === "in_progress") return "En cours";
  if (status === EXECUTION_SURFACE_STATUS.MISSED) return "Manquée";
  if (status === EXECUTION_SURFACE_STATUS.POSTPONED) return "Reportée";
  if (status === EXECUTION_SURFACE_STATUS.BLOCKED) return "Bloquée";
  if (status === EXECUTION_SURFACE_STATUS.REPORTED) return "Signalée";
  return TIMELINE_SCREEN_COPY.upcoming;
}

export function resolveTimelineTone(status, { isCurrent = false, isSelectedDay = false } = {}) {
  if (status === EXECUTION_SURFACE_STATUS.DONE || status === EXECUTION_SURFACE_STATUS.ACTIVE || status === "in_progress") {
    return "execution";
  }
  if (
    status === EXECUTION_SURFACE_STATUS.MISSED ||
    status === EXECUTION_SURFACE_STATUS.POSTPONED ||
    status === EXECUTION_SURFACE_STATUS.BLOCKED ||
    status === EXECUTION_SURFACE_STATUS.REPORTED
  ) {
    return "attention";
  }
  if (isCurrent && isSelectedDay) return "execution";
  return "neutral";
}

export function isTimelineNextFocusCandidate(status) {
  return (
    status === EXECUTION_SURFACE_STATUS.PLANNED ||
    status === EXECUTION_SURFACE_STATUS.ACTIVE ||
    status === EXECUTION_SURFACE_STATUS.BLOCKED ||
    status === EXECUTION_SURFACE_STATUS.REPORTED ||
    status === "in_progress"
  );
}

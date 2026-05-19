import { addDaysLocal, fromLocalDateKey, getWeekdayShortLabel, normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";

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

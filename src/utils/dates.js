import { getWeekdayShortLabel as getWeekdayShortLabelShared, toLocalDateKey } from "./datetime";

// LOCAL DATE KEY ONLY (no UTC)
export function todayKey(d = new Date()) {
  return toLocalDateKey(d);
}

export function dayKey(d = new Date()) {
  return todayKey(d);
}

export function addDays(d, n) {
  const dd = new Date(d);
  dd.setDate(dd.getDate() + n);
  return dd;
}

export function buildDateWindow(anchorDate, beforeDays = 15, afterDays = 15) {
  if (!(anchorDate instanceof Date)) return [];
  const before = Math.max(0, beforeDays);
  const after = Math.max(0, afterDays);
  const items = [];
  for (let offset = -before; offset <= after; offset += 1) {
    items.push(addDays(anchorDate, offset));
  }
  return items;
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfWeekKey(d = new Date()) {
  const dd = new Date(d);
  const day = dd.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  dd.setDate(dd.getDate() + diff);
  return todayKey(dd);
}

export function yearKey(d = new Date()) {
  return String(d.getFullYear());
}

export function isSameDayKey(aKey, bKey) {
  return Boolean(aKey && bKey && aKey === bKey);
}

export const WEEK_DAYS_PER_WEEK = 7;
export const WEEKDAY_LABELS_FR = ["L", "M", "M", "J", "V", "S", "D"];
export { getWeekdayShortLabelShared as getWeekdayShortLabel };

const MONTH_LABEL_FR = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

export function getMonthLabelFR(d) {
  return d ? MONTH_LABEL_FR.format(d) : "";
}

export function buildMonthGrid(d = new Date()) {
  const first = startOfMonth(d);
  const weekday = first.getDay(); // 0=Dim, 1=Lun
  const mondayIndex = (weekday + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayIndex);
  const cells = [];
  const totalCells = WEEK_DAYS_PER_WEEK * 6;
  for (let i = 0; i < totalCells; i += 1) {
    const dateObj = new Date(gridStart);
    dateObj.setDate(gridStart.getDate() + i);
    cells.push({
      dateObj,
      key: dayKey(dateObj),
      inMonth: dateObj.getMonth() === d.getMonth(),
      dayNumber: dateObj.getDate(),
    });
  }
  return cells;
}

export function getDayStatus(selectedKey, now = new Date()) {
  const today = todayKey(now);
  if (!selectedKey) return "today";
  if (selectedKey === today) return "today";
  return selectedKey < today ? "past" : "future";
}

// Backward-compatible alias
export function dayStatus(selectedKey, now = new Date()) {
  return getDayStatus(selectedKey, now);
}

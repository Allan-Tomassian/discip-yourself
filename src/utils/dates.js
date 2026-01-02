export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function dayKey(d = new Date()) {
  return todayKey(d);
}

export function addDays(d, n) {
  const dd = new Date(d);
  dd.setDate(dd.getDate() + n);
  return dd;
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

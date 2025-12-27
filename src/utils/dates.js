export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
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
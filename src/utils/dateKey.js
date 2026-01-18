export function toLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromLocalDateKey(key) {
  if (typeof key === "string") {
    const cleaned = normalizeLocalDateKey(key);
    if (cleaned) {
      const [y, m, d] = cleaned.split("-").map((v) => parseInt(v, 10));
      if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
        return new Date(y, m - 1, d, 12, 0, 0);
      }
    }
  }
  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);
  return fallback;
}

export function normalizeLocalDateKey(key) {
  if (key instanceof Date) return toLocalDateKey(key);
  if (typeof key !== "string") return "";
  const trimmed = key.trim();
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const [y, m, d] = candidate.split("-").map((v) => parseInt(v, 10));
  const rebuilt = new Date(y, m - 1, d, 12, 0, 0);
  return toLocalDateKey(rebuilt) === candidate ? candidate : "";
}

export function todayLocalKey() {
  return toLocalDateKey(new Date());
}

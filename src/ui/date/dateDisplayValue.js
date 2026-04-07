import { normalizeLocalDateKey } from "../../utils/dateKey";

export function formatDisplayValue(value) {
  const normalized = normalizeLocalDateKey(value);
  if (!normalized) return "";
  const [y, m, d] = normalized.split("-");
  return `${d}/${m}/${y}`;
}

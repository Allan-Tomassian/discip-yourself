import { normalizeLocalDateKey } from "../../utils/dateKey";

const MINUTE_MS = 60 * 1000;

export function resolveOccurrenceStartMs(occurrence) {
  if (!occurrence || typeof occurrence !== "object") return null;
  const dateKey = normalizeLocalDateKey(occurrence.date);
  if (!dateKey) return null;
  const rawTime =
    typeof occurrence.start === "string" && occurrence.start
      ? occurrence.start
      : typeof occurrence.slotKey === "string" && occurrence.slotKey
        ? occurrence.slotKey
        : "00:00";
  const parts = rawTime.split(":").map((v) => parseInt(v, 10));
  if (parts.length < 2) return null;
  const [hour, minute] = parts;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const [y, m, d] = dateKey.split("-").map((v) => parseInt(v, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
  const ms = dt.getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function resolveCurrentPlannedOccurrence(occurrences, now = new Date(), windowMinutes = { past: 30, future: 90 }) {
  if (!Array.isArray(occurrences) || !occurrences.length) return null;
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const pastMs = nowMs - (windowMinutes?.past ?? 30) * MINUTE_MS;
  const futureMs = nowMs + (windowMinutes?.future ?? 90) * MINUTE_MS;
  let best = null;
  let bestDiff = Infinity;
  let bestStart = Infinity;
  for (const occ of occurrences) {
    if (!occ || occ.status !== "planned") continue;
    const startMs = resolveOccurrenceStartMs(occ);
    if (!Number.isFinite(startMs)) continue;
    if (startMs < pastMs || startMs > futureMs) continue;
    const diff = Math.abs(startMs - nowMs);
    if (diff < bestDiff || (diff === bestDiff && startMs < bestStart)) {
      best = occ;
      bestDiff = diff;
      bestStart = startMs;
    }
  }
  return best;
}

export function resolveNextPlannedOccurrence(occurrences, now = new Date()) {
  if (!Array.isArray(occurrences) || !occurrences.length) return null;
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  let best = null;
  let bestStart = Infinity;
  for (const occ of occurrences) {
    if (!occ || occ.status !== "planned") continue;
    const startMs = resolveOccurrenceStartMs(occ);
    if (!Number.isFinite(startMs)) continue;
    if (startMs <= nowMs) continue;
    if (startMs < bestStart) {
      best = occ;
      bestStart = startMs;
    }
  }
  return best;
}

export function listUpcomingPlannedOccurrences(occurrences, now = new Date(), limit = 4, windowMinutes = { past: 30 }) {
  if (!Array.isArray(occurrences) || !occurrences.length) return [];
  const nowMs = now instanceof Date ? now.getTime() : Date.now();
  const pastMs = nowMs - (windowMinutes?.past ?? 30) * MINUTE_MS;
  const items = [];
  for (const occ of occurrences) {
    if (!occ || occ.status !== "planned") continue;
    const startMs = resolveOccurrenceStartMs(occ);
    if (!Number.isFinite(startMs) || startMs < pastMs) continue;
    items.push({ occ, startMs });
  }
  items.sort((a, b) => a.startMs - b.startMs);
  return items.slice(0, Math.max(1, limit)).map((item) => item.occ);
}

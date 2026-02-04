import { normalizeLocalDateKey } from "../../utils/dateKey";

function parseTimeToMinutes(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function resolveStartMinutes(occ) {
  if (!occ || typeof occ !== "object") return null;
  const raw = typeof occ.start === "string" && occ.start ? occ.start : typeof occ.slotKey === "string" ? occ.slotKey : "";
  return parseTimeToMinutes(raw);
}

function isFixedOccurrence(occ) {
  if (!occ || typeof occ !== "object") return false;
  if (occ.noTime === true) return false;
  if (occ.timeType === "window") return false;
  const startMin = resolveStartMinutes(occ);
  return Number.isFinite(startMin);
}

function resolvePriorityRank(occ) {
  const raw = typeof occ?.priority === "string" ? occ.priority : typeof occ?.priorityLevel === "string" ? occ.priorityLevel : "";
  const key = raw.toLowerCase();
  if (key === "prioritaire" || key === "primary") return 3;
  if (key === "secondaire" || key === "secondary") return 2;
  if (key === "bonus") return 1;
  return 0;
}

function stableKey(occ) {
  const goalId = typeof occ?.goalId === "string" ? occ.goalId : "";
  const id = typeof occ?.id === "string" ? occ.id : "";
  return `${goalId}:${id}`;
}

function sortByPriorityThenStable(a, b) {
  const pa = resolvePriorityRank(a);
  const pb = resolvePriorityRank(b);
  if (pa !== pb) return pb - pa;
  return stableKey(a).localeCompare(stableKey(b));
}

export function getNextPlannedOccurrence({ dateKey, now = new Date(), occurrences = [] }) {
  const date = normalizeLocalDateKey(dateKey);
  if (!date) return null;
  const list = Array.isArray(occurrences) ? occurrences.filter((o) => o && o.status === "planned" && o.date === date) : [];
  if (!list.length) return null;

  const todayKey = normalizeLocalDateKey(now);
  const nowMin = date === todayKey ? (now instanceof Date ? now.getHours() * 60 + now.getMinutes() : 0) : -1;

  const fixedFuture = list
    .filter((o) => isFixedOccurrence(o))
    .map((o) => ({ occ: o, startMin: resolveStartMinutes(o) }))
    .filter((item) => Number.isFinite(item.startMin) && item.startMin >= nowMin)
    .sort((a, b) => a.startMin - b.startMin || sortByPriorityThenStable(a.occ, b.occ));

  if (fixedFuture.length) return fixedFuture[0].occ;

  const fixedAll = list
    .filter((o) => isFixedOccurrence(o))
    .map((o) => ({ occ: o, startMin: resolveStartMinutes(o) }))
    .filter((item) => Number.isFinite(item.startMin))
    .sort((a, b) => a.startMin - b.startMin || sortByPriorityThenStable(a.occ, b.occ));

  if (fixedAll.length) return fixedAll[0].occ;

  const nonFixed = list.filter((o) => !isFixedOccurrence(o)).slice().sort(sortByPriorityThenStable);
  return nonFixed[0] || null;
}

export function getAlternativeCandidates({ dateKey, now = new Date(), occurrences = [], limit = 4, excludeId = null }) {
  const date = normalizeLocalDateKey(dateKey);
  if (!date) return [];
  const list = Array.isArray(occurrences) ? occurrences.filter((o) => o && o.status === "planned" && o.date === date) : [];
  if (!list.length) return [];

  const todayKey = normalizeLocalDateKey(now);
  const nowMin = date === todayKey ? (now instanceof Date ? now.getHours() * 60 + now.getMinutes() : 0) : -1;

  const candidates = list.filter((o) => o && o.id !== excludeId);

  const nonFixed = candidates
    .filter((o) => !isFixedOccurrence(o))
    .sort(sortByPriorityThenStable)
    .map((o) => ({ occ: o, kind: "non_fixed", warning: false }));

  const fixedFuture = candidates
    .filter((o) => isFixedOccurrence(o))
    .map((o) => ({ occ: o, startMin: resolveStartMinutes(o) }))
    .filter((item) => Number.isFinite(item.startMin) && item.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin || sortByPriorityThenStable(a.occ, b.occ))
    .map((item) => ({ occ: item.occ, kind: "fixed_future", warning: true }));

  return [...nonFixed, ...fixedFuture].slice(0, Math.max(0, limit));
}

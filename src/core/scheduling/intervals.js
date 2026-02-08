import { clampTimeToDay, minutesToTimeStr, normalizeLocalDateKey, parseTimeToMinutes } from "../../utils/datetime";

const DEFAULT_DURATION_MIN = 30;
const MINUTES_PER_DAY = 24 * 60;

function resolveDuration(value, fallback = DEFAULT_DURATION_MIN) {
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  return fallback;
}

export function computeInterval({ dateKey, startHHmm, durationMin, defaultDuration = DEFAULT_DURATION_MIN }) {
  const date = normalizeLocalDateKey(dateKey);
  if (!date) return null;
  const startMin = parseTimeToMinutes(startHHmm);
  if (!Number.isFinite(startMin)) return null;
  const duration = resolveDuration(durationMin, defaultDuration);
  return {
    dateKey: date,
    startMin,
    endMin: startMin + duration,
    durationMin: duration,
  };
}

export function overlaps(a, b) {
  if (!a || !b) return false;
  if (a.dateKey && b.dateKey && a.dateKey !== b.dateKey) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function findConflicts({ dateKey, candidate, existingFixedOccurrences = [], defaultDuration = DEFAULT_DURATION_MIN }) {
  const date = normalizeLocalDateKey(dateKey || candidate?.dateKey);
  if (!date) return [];
  const candidateInterval = computeInterval({
    dateKey: date,
    startHHmm: candidate?.startHHmm,
    durationMin: candidate?.durationMin,
    defaultDuration,
  });
  if (!candidateInterval) return [];

  const conflicts = [];
  for (const other of existingFixedOccurrences) {
    const otherInterval = computeInterval({
      dateKey: date,
      startHHmm: other?.startHHmm,
      durationMin: other?.durationMin,
      defaultDuration,
    });
    if (!otherInterval) continue;
    if (overlaps(candidateInterval, otherInterval)) {
      conflicts.push({ candidate: candidateInterval, conflict: otherInterval, source: other });
    }
  }
  return conflicts;
}

export function suggestNextSlots({
  dateKey,
  candidate,
  existing = [],
  step = 15,
  limit = 3,
  defaultDuration = DEFAULT_DURATION_MIN,
}) {
  const date = normalizeLocalDateKey(dateKey || candidate?.dateKey);
  if (!date) return [];
  const candidateInterval = computeInterval({
    dateKey: date,
    startHHmm: candidate?.startHHmm,
    durationMin: candidate?.durationMin,
    defaultDuration,
  });
  if (!candidateInterval) return [];

  const taken = existing
    .map((other) =>
      computeInterval({
        dateKey: date,
        startHHmm: other?.startHHmm,
        durationMin: other?.durationMin,
        defaultDuration,
      })
    )
    .filter(Boolean);

  const duration = candidateInterval.durationMin;
  const isFree = (startMin) => {
    const probe = { dateKey: date, startMin, endMin: startMin + duration };
    return !taken.some((t) => overlaps(probe, t));
  };

  const suggestions = [];
  const candidates = [candidateInterval.startMin + step, candidateInterval.startMin + step * 2];
  for (const startMin of candidates) {
    if (startMin < 0 || startMin > MINUTES_PER_DAY - 1) continue;
    if (!isFree(startMin)) continue;
    const label = minutesToTimeStr(clampTimeToDay(startMin));
    if (label && !suggestions.includes(label)) suggestions.push(label);
  }

  if (suggestions.length < limit) {
    const maxSteps = Math.ceil(MINUTES_PER_DAY / Math.max(1, step));
    for (let i = 1; i <= maxSteps && suggestions.length < limit; i += 1) {
      const startMin = candidateInterval.startMin + step * i;
      if (startMin < 0 || startMin > MINUTES_PER_DAY - 1) continue;
      if (!isFree(startMin)) continue;
      const label = minutesToTimeStr(clampTimeToDay(startMin));
      if (label && !suggestions.includes(label)) suggestions.push(label);
    }
  }

  return suggestions.slice(0, limit);
}

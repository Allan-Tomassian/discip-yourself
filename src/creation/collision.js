function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function buildTimeWindow({ dateKey, time, durationMinutes }) {
  const startMinutes = parseTimeToMinutes(time);
  const duration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;
  if (!dateKey || startMinutes == null || duration <= 0) return null;
  return {
    dateKey,
    startMinutes,
    endMinutes: startMinutes + duration,
  };
}

export function windowsOverlap(a, b) {
  if (!a || !b) return false;
  if (a.dateKey !== b.dateKey) return false;
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export function findCollisions(candidate, others = []) {
  const window = buildTimeWindow(candidate);
  if (!window) return [];
  const conflicts = [];
  for (const other of others) {
    const otherWindow = buildTimeWindow(other);
    if (!otherWindow) continue;
    if (windowsOverlap(window, otherWindow)) conflicts.push({ candidate: window, conflict: otherWindow });
  }
  return conflicts;
}

export function hasCollision(candidate, others = []) {
  return findCollisions(candidate, others).length > 0;
}

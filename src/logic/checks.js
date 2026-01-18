import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";

function normalizeHabits(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const id of list) {
    if (typeof id !== "string" || !id.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeMicro(micro) {
  if (Array.isArray(micro)) {
    return micro.reduce((acc, id) => {
      if (typeof id === "string" && id.trim()) acc[id] = true;
      return acc;
    }, {});
  }
  if (micro && typeof micro === "object") return { ...micro };
  return {};
}

function getChecksMap(state) {
  return state?.checks && typeof state.checks === "object" ? state.checks : {};
}

export function getChecksForDate(state, dateKey) {
  const key = normalizeLocalDateKey(dateKey);
  if (!key) return { habits: [], micro: {} };
  const checks = getChecksMap(state);
  const bucket = checks?.[key];
  const habits = normalizeHabits(bucket?.habits);
  const micro = normalizeMicro(bucket?.micro);
  return { habits, micro };
}

export function hasHabitChecked(state, dateKey, habitId) {
  if (typeof habitId !== "string" || !habitId.trim()) return false;
  const { habits } = getChecksForDate(state, dateKey);
  return habits.includes(habitId);
}

export function setHabitChecked(state, dateKey, habitId, checked) {
  if (!state || typeof state !== "object") return state;
  if (typeof habitId !== "string" || !habitId.trim()) return state;
  const key = normalizeLocalDateKey(dateKey) || todayLocalKey();
  if (!key) return state;

  const prevChecks = getChecksMap(state);
  const prevBucket = prevChecks?.[key] && typeof prevChecks[key] === "object" ? prevChecks[key] : {};
  const prevHabits = normalizeHabits(prevBucket.habits);
  const has = prevHabits.includes(habitId);
  if (checked && has) return state;
  if (!checked && !has) return state;

  const nextHabits = checked
    ? [...prevHabits, habitId]
    : prevHabits.filter((id) => id !== habitId);

  return {
    ...state,
    checks: {
      ...prevChecks,
      [key]: {
        ...prevBucket,
        habits: nextHabits,
        micro: normalizeMicro(prevBucket.micro),
      },
    },
  };
}

export function setMicroChecked(state, dateKey, microId, checked) {
  if (!state || typeof state !== "object") return state;
  if (typeof microId !== "string" || !microId.trim()) return state;
  const key = normalizeLocalDateKey(dateKey) || todayLocalKey();
  if (!key) return state;

  const prevChecks = getChecksMap(state);
  const prevBucket = prevChecks?.[key] && typeof prevChecks[key] === "object" ? prevChecks[key] : {};
  const prevMicro = normalizeMicro(prevBucket.micro);
  const has = Boolean(prevMicro[microId]);
  if (checked && has) return state;
  if (!checked && !has) return state;

  const nextMicro = { ...prevMicro };
  if (checked) nextMicro[microId] = true;
  else delete nextMicro[microId];

  return {
    ...state,
    checks: {
      ...prevChecks,
      [key]: {
        ...prevBucket,
        habits: normalizeHabits(prevBucket.habits),
        micro: nextMicro,
      },
    },
  };
}

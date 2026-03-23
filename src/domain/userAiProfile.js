import { addDaysLocal, fromLocalDateKey, normalizeLocalDateKey, parseTimeToMinutes, toLocalDateKey } from "../utils/datetime.js";

export const USER_AI_GOAL_IDS = Object.freeze([
  "health",
  "business",
  "learning",
  "productivity",
  "personal",
  "finance",
]);

export const USER_AI_TIME_BUDGETS = Object.freeze([30, 60, 90, 120]);
export const USER_AI_INTENSITIES = Object.freeze(["light", "balanced", "intense"]);
export const USER_AI_TIME_BLOCKS = Object.freeze(["morning", "afternoon", "evening"]);
export const USER_AI_STRUCTURES = Object.freeze(["simple", "structured", "optimized"]);
export const USER_AI_STABILITY = Object.freeze(["low", "medium", "high"]);

export const USER_AI_BEHAVIOR_WINDOW_DAYS = 7;

export const USER_AI_CATEGORY_META = Object.freeze({
  health: {
    id: "health",
    label: "Santé",
    color: "#22C55E",
  },
  business: {
    id: "business",
    label: "Business",
    color: "#0EA5E9",
  },
  learning: {
    id: "learning",
    label: "Apprentissage",
    color: "#EAB308",
  },
  productivity: {
    id: "productivity",
    label: "Productivité",
    color: "#6366F1",
  },
  personal: {
    id: "personal",
    label: "Personnel",
    color: "#F97316",
  },
  finance: {
    id: "finance",
    label: "Finance",
    color: "#10B981",
  },
});

export const USER_AI_TIME_BLOCK_WINDOWS = Object.freeze({
  morning: {
    id: "morning",
    label: "Matin",
    windowStart: "07:00",
    windowEnd: "12:00",
    anchor: "08:00",
  },
  afternoon: {
    id: "afternoon",
    label: "Apres-midi",
    windowStart: "12:00",
    windowEnd: "18:00",
    anchor: "14:00",
  },
  evening: {
    id: "evening",
    label: "Soir",
    windowStart: "18:00",
    windowEnd: "22:00",
    anchor: "19:00",
  },
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractTimeFromLocalDateTime(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/T([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : "";
}

function normalizeGoals(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const rawValue of value) {
    const goalId = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!goalId || !USER_AI_GOAL_IDS.includes(goalId) || seen.has(goalId)) continue;
    seen.add(goalId);
    out.push(goalId);
    if (out.length >= 3) break;
  }
  return out;
}

function normalizeBudget(value) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return USER_AI_TIME_BUDGETS.includes(numeric) ? numeric : 60;
}

function normalizeEnum(value, allowed, fallback) {
  const nextValue = typeof value === "string" ? value.trim() : "";
  return allowed.includes(nextValue) ? nextValue : fallback;
}

function normalizeTimeBlocks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const rawValue of value) {
    const blockId = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!blockId || !USER_AI_TIME_BLOCKS.includes(blockId) || seen.has(blockId)) continue;
    seen.add(blockId);
    out.push(blockId);
  }
  return out;
}

function normalizeAdaptation(value, intensityPreference = "balanced") {
  const source = isPlainObject(value) ? value : {};
  return {
    implicit_intensity: normalizeEnum(source.implicit_intensity, USER_AI_INTENSITIES, intensityPreference),
    suggestion_stability: normalizeEnum(source.suggestion_stability, USER_AI_STABILITY, "medium"),
    behavior_window_days: USER_AI_BEHAVIOR_WINDOW_DAYS,
    last_behavior_update_at: typeof source.last_behavior_update_at === "string" ? source.last_behavior_update_at : "",
  };
}

export function createDefaultUserAiProfile(overrides = {}) {
  const source = isPlainObject(overrides) ? overrides : {};
  const createdAt = typeof source.created_at === "string" && source.created_at ? source.created_at : "";
  const updatedAt = typeof source.updated_at === "string" && source.updated_at ? source.updated_at : createdAt;
  const intensityPreference = normalizeEnum(source.intensity_preference, USER_AI_INTENSITIES, "balanced");
  return {
    goals: normalizeGoals(source.goals),
    time_budget_daily_min: normalizeBudget(source.time_budget_daily_min),
    intensity_preference: intensityPreference,
    preferred_time_blocks: normalizeTimeBlocks(source.preferred_time_blocks),
    structure_preference: normalizeEnum(source.structure_preference, USER_AI_STRUCTURES, "structured"),
    adaptation: normalizeAdaptation(source.adaptation, intensityPreference),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function normalizeUserAiProfile(value) {
  return createDefaultUserAiProfile(value);
}

export function getUserAiCategoryMeta(goalId) {
  return USER_AI_CATEGORY_META[goalId] || null;
}

export function getUserAiTimeBlockWindow(blockId) {
  return USER_AI_TIME_BLOCK_WINDOWS[blockId] || null;
}

function normalizeOccurrenceStatus(rawStatus) {
  return typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
}

function countWindowBehavior({ occurrences, now = new Date(), windowDays = USER_AI_BEHAVIOR_WINDOW_DAYS }) {
  const todayKey = normalizeLocalDateKey(now) || toLocalDateKey(now);
  const fromKey = addDaysLocal(todayKey, -(Math.max(1, windowDays) - 1));
  const summary = {
    total: 0,
    done: 0,
    missed: 0,
    rescheduled: 0,
  };

  for (const occurrence of Array.isArray(occurrences) ? occurrences : []) {
    const dateKey = normalizeLocalDateKey(occurrence?.date);
    if (!dateKey || (fromKey && dateKey < fromKey) || (todayKey && dateKey > todayKey)) continue;
    const status = normalizeOccurrenceStatus(occurrence?.status);
    if (!status) continue;
    summary.total += 1;
    if (status === "done") summary.done += 1;
    if (status === "missed") summary.missed += 1;
    if (status === "rescheduled") summary.rescheduled += 1;
  }

  return summary;
}

export function deriveUserAiAdaptation({
  profile,
  occurrences = [],
  now = new Date(),
}) {
  const normalizedProfile = normalizeUserAiProfile(profile);
  const windowDays = normalizedProfile.adaptation.behavior_window_days || USER_AI_BEHAVIOR_WINDOW_DAYS;
  const behavior = countWindowBehavior({ occurrences, now, windowDays });
  const implicitIntensity =
    behavior.total > 0 && behavior.missed + behavior.rescheduled > behavior.done
      ? "light"
      : normalizedProfile.intensity_preference;
  const doneRatio = behavior.total > 0 ? behavior.done / behavior.total : 0;
  const stability =
    behavior.total >= 4 && doneRatio >= 0.7
      ? "high"
      : behavior.total > 0 && behavior.missed + behavior.rescheduled > behavior.done
        ? "low"
        : "medium";

  return {
    implicit_intensity: implicitIntensity,
    suggestion_stability: stability,
    behavior_window_days: USER_AI_BEHAVIOR_WINDOW_DAYS,
    last_behavior_update_at: now.toISOString(),
  };
}

export function updateUserAiProfileAdaptation({ profile, occurrences = [], now = new Date() }) {
  const normalizedProfile = normalizeUserAiProfile(profile);
  const nextAdaptation = deriveUserAiAdaptation({ profile: normalizedProfile, occurrences, now });
  const current = normalizedProfile.adaptation || {};
  if (
    current.implicit_intensity === nextAdaptation.implicit_intensity &&
    current.suggestion_stability === nextAdaptation.suggestion_stability &&
    current.behavior_window_days === nextAdaptation.behavior_window_days
  ) {
    return normalizedProfile;
  }

  return {
    ...normalizedProfile,
    adaptation: nextAdaptation,
    updated_at: now.toISOString(),
  };
}

function resolveOccurrenceReferenceTime(occurrenceOrTime) {
  if (typeof occurrenceOrTime === "string") return occurrenceOrTime;
  const directStart = occurrenceOrTime?.start || occurrenceOrTime?.slotKey || "";
  if (directStart && directStart !== "00:00") return directStart;
  const windowStart = extractTimeFromLocalDateTime(occurrenceOrTime?.windowStartAt);
  if (windowStart) return windowStart;
  return extractTimeFromLocalDateTime(occurrenceOrTime?.windowEndAt);
}

function resolveTimeBlockRank(preferredTimeBlocks, occurrenceOrTime) {
  const minutes = parseTimeToMinutes(resolveOccurrenceReferenceTime(occurrenceOrTime));
  if (!Number.isFinite(minutes) || !Array.isArray(preferredTimeBlocks) || preferredTimeBlocks.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const matchedBlock = preferredTimeBlocks.find((blockId) => {
    const block = getUserAiTimeBlockWindow(blockId);
    if (!block) return false;
    const startMinutes = parseTimeToMinutes(block.windowStart);
    const endMinutes = parseTimeToMinutes(block.windowEnd);
    return Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && minutes >= startMinutes && minutes < endMinutes;
  });
  const rank = preferredTimeBlocks.indexOf(matchedBlock);
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}

export function compareOccurrencesByUserAiPreference(leftOccurrence, rightOccurrence, preferredTimeBlocks = []) {
  const leftRank = resolveTimeBlockRank(preferredTimeBlocks, leftOccurrence);
  const rightRank = resolveTimeBlockRank(preferredTimeBlocks, rightOccurrence);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftDate = normalizeLocalDateKey(leftOccurrence?.date) || "";
  const rightDate = normalizeLocalDateKey(rightOccurrence?.date) || "";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);

  const leftStart = leftOccurrence?.start || leftOccurrence?.slotKey || "";
  const rightStart = rightOccurrence?.start || rightOccurrence?.slotKey || "";
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);

  const leftId = typeof leftOccurrence?.id === "string" ? leftOccurrence.id : "";
  const rightId = typeof rightOccurrence?.id === "string" ? rightOccurrence.id : "";
  return leftId.localeCompare(rightId);
}

export function derivePreferredBlockAlignment({ preferredTimeBlocks = [], occurrences = [] }) {
  const blocks = Array.isArray(preferredTimeBlocks) ? preferredTimeBlocks : [];
  if (!blocks.length) return "none";
  if (!Array.isArray(occurrences) || occurrences.length === 0) return "unplanned";

  const matchedCount = occurrences.filter((occurrence) => {
    return resolveTimeBlockRank(blocks, occurrence) !== Number.POSITIVE_INFINITY;
  }).length;
  if (!matchedCount) return "off_preference";
  return matchedCount === occurrences.length ? "full_match" : "partial_match";
}

export function buildUserAiProfileSignature(profile) {
  const normalizedProfile = normalizeUserAiProfile(profile);
  return JSON.stringify({
    goals: normalizedProfile.goals,
    time_budget_daily_min: normalizedProfile.time_budget_daily_min,
    intensity_preference: normalizedProfile.intensity_preference,
    preferred_time_blocks: normalizedProfile.preferred_time_blocks,
    structure_preference: normalizedProfile.structure_preference,
    adaptation: normalizedProfile.adaptation,
  });
}

export function resolveDateKeyWithinBehaviorWindow({ now = new Date(), daysAgo = 0 }) {
  const base = now instanceof Date ? new Date(now) : fromLocalDateKey(normalizeLocalDateKey(now));
  if (!(base instanceof Date) || Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() - Math.max(0, Math.trunc(daysAgo)));
  return toLocalDateKey(base);
}

export const FIRST_RUN_PLAN_RESPONSE_VERSION = 2;
export const FIRST_RUN_PLAN_VARIANTS = Object.freeze(["tenable", "ambitious"]);
export const FIRST_RUN_PLAN_CATEGORY_IDS = Object.freeze([
  "health",
  "business",
  "learning",
  "productivity",
  "personal",
  "finance",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeLocale(value) {
  const normalized = trimString(value, 32);
  return normalized || "fr-FR";
}

function normalizeTimezone(value) {
  const normalized = trimString(value, 80);
  return normalized || "Europe/Paris";
}

function normalizeDateKey(value) {
  const normalized = trimString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((rawValue) => {
    const numeric = Number(rawValue);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 7 || seen.has(numeric)) return;
    seen.add(numeric);
    out.push(numeric);
  });
  return out;
}

function normalizeTime(value) {
  const normalized = trimString(value, 5);
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : "";
}

function hasMeaningfulWindowFields(windowLike) {
  if (!windowLike || typeof windowLike !== "object") return false;
  return Boolean(
    trimString(windowLike.label, 80) ||
      normalizeTime(windowLike.startTime) ||
      normalizeTime(windowLike.endTime) ||
      normalizeDaysOfWeek(windowLike.daysOfWeek).length
  );
}

function normalizeFirstRunSubmitWindows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => hasMeaningfulWindowFields(entry))
    .map((entry) => ({
      id: trimString(entry?.id, 120),
      daysOfWeek: normalizeDaysOfWeek(entry?.daysOfWeek),
      startTime: normalizeTime(entry?.startTime),
      endTime: normalizeTime(entry?.endTime),
      label: trimString(entry?.label, 80),
    }))
    .filter((entry) => entry.startTime && entry.endTime && entry.daysOfWeek.length);
}

function normalizePriorityCategoryIds(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((rawValue) => {
    const normalized = trimString(rawValue, 80);
    if (!normalized || !FIRST_RUN_PLAN_CATEGORY_IDS.includes(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out.slice(0, 3);
}

function normalizeSubmitDraftAnswers(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    whyText: trimString(source.whyText, 1200),
    primaryGoal: trimString(source.primaryGoal, 240),
    unavailableWindows: normalizeFirstRunSubmitWindows(source.unavailableWindows),
    preferredWindows: normalizeFirstRunSubmitWindows(source.preferredWindows),
    currentCapacity:
      source.currentCapacity === "reprise" || source.currentCapacity === "stable" || source.currentCapacity === "forte"
        ? source.currentCapacity
        : null,
    priorityCategoryIds: normalizePriorityCategoryIds(source.priorityCategoryIds),
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function normalizeFirstRunPlanRequestPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const draftAnswers = normalizeSubmitDraftAnswers(source);
  return {
    whyText: draftAnswers.whyText,
    primaryGoal: draftAnswers.primaryGoal,
    unavailableWindows: draftAnswers.unavailableWindows,
    preferredWindows: draftAnswers.preferredWindows,
    currentCapacity: draftAnswers.currentCapacity,
    priorityCategoryIds: draftAnswers.priorityCategoryIds,
    timezone: normalizeTimezone(source.timezone),
    locale: normalizeLocale(source.locale),
    referenceDateKey: normalizeDateKey(source.referenceDateKey),
  };
}

export function serializeFirstRunPlanInput(payload) {
  return stableSerialize(normalizeFirstRunPlanRequestPayload(payload));
}

export function getFirstRunPlanTitle(variant) {
  return variant === "ambitious" ? "Plan ambitieux" : "Plan tenable";
}

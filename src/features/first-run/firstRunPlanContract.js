export const FIRST_RUN_PLAN_RESPONSE_VERSION = 2;
export const FIRST_RUN_RECOMMENDED_PLAN_RESPONSE_VERSION = 3;
export const FIRST_RUN_RECOMMENDED_PLAN_ID = "recommended";
export const FIRST_RUN_DETERMINISTIC_SOURCE = "deterministic_starter";
export const FIRST_RUN_AI_ASSISTED_SOURCE = "ai_assisted_starter";
export const FIRST_RUN_STARTER_HINTS_RESPONSE_VERSION = 1;
export const FIRST_RUN_STARTER_HINTS_SOURCE = "ai_starter_hints";
export const FIRST_RUN_WHY_CLARIFICATION_RESPONSE_VERSION = 1;
export const FIRST_RUN_WHY_CLARIFICATION_SOURCE = "ai_why_clarification";
export const FIRST_RUN_WHY_CLARIFICATION_MODES = Object.freeze(["inspiration", "clarify"]);
export const FIRST_RUN_PLAN_VARIANTS = Object.freeze(["tenable", "ambitious"]);
export const FIRST_RUN_SUPPORTED_PLAN_VARIANTS = Object.freeze([
  FIRST_RUN_RECOMMENDED_PLAN_ID,
  ...FIRST_RUN_PLAN_VARIANTS,
]);
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

function normalizeWhyClarificationMode(value) {
  const normalized = trimString(value, 32).toLowerCase();
  return FIRST_RUN_WHY_CLARIFICATION_MODES.includes(normalized) ? normalized : "inspiration";
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

function normalizeConstraints(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((rawValue) => {
    const normalized = trimString(rawValue, 160);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out.slice(0, 8);
}

function normalizeContextPacks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = isPlainObject(entry) ? entry : {};
      const type = trimString(source.type, 40);
      const label = trimString(source.label, 120);
      const summary = trimString(source.summary, 1000);
      const signals = normalizeConstraints(source.signals).slice(0, 8);
      const updatedAt = trimString(source.updatedAt, 80);
      if (!type || !summary) return null;
      return {
        type,
        label,
        summary,
        signals,
        updatedAt,
      };
    })
    .filter(Boolean)
    .slice(0, 4);
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

export function normalizeFirstRunStarterHintsRequestPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const basePayload = normalizeFirstRunPlanRequestPayload(source);
  return {
    ...basePayload,
    constraints: normalizeConstraints(source.constraints),
    contextPacks: normalizeContextPacks(source.contextPacks),
  };
}

export function normalizeFirstRunWhyClarificationRequestPayload(input) {
  const source = isPlainObject(input) ? input : {};
  return {
    version: FIRST_RUN_WHY_CLARIFICATION_RESPONSE_VERSION,
    mode: normalizeWhyClarificationMode(source.mode),
    whyText: trimString(source.whyText, 1200),
    timezone: normalizeTimezone(source.timezone),
    locale: normalizeLocale(source.locale),
    referenceDateKey: normalizeDateKey(source.referenceDateKey),
  };
}

export function serializeFirstRunPlanInput(payload) {
  return stableSerialize(normalizeFirstRunPlanRequestPayload(payload));
}

export function serializeFirstRunStarterHintsInput(payload) {
  return stableSerialize(normalizeFirstRunStarterHintsRequestPayload(payload));
}

export function serializeFirstRunWhyClarificationInput(payload) {
  return stableSerialize(normalizeFirstRunWhyClarificationRequestPayload(payload));
}

export function getFirstRunPlanTitle(variant) {
  if (variant === FIRST_RUN_RECOMMENDED_PLAN_ID) return "Plan recommandé";
  return variant === "ambitious" ? "Plan ambitieux" : "Plan tenable";
}

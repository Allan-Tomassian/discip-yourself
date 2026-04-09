import { normalizeRouteOrigin } from "../app/routeOrigin";
import {
  buildSessionBlueprintDraft,
  normalizePrimaryActionRef,
  normalizeSessionBlueprintDraft,
} from "../features/action-protocol/sessionBlueprint";

const CREATE_ITEM_KINDS = new Set(["action", "outcome", "guided", "assistant"]);
const REPEAT_VALUES = new Set(["none", "daily", "weekly"]);
const PRIORITY_VALUES = new Set(["prioritaire", "secondaire", "bonus"]);
const QUANTITY_PERIODS = new Set(["DAY", "WEEK", "MONTH"]);

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const next = asString(value);
  return next || null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

function normalizeKind(value, fallback = "action") {
  const next = asString(value).toLowerCase();
  return CREATE_ITEM_KINDS.has(next) ? next : fallback;
}

function normalizeRepeat(value, fallback = "none") {
  const next = asString(value).toLowerCase();
  return REPEAT_VALUES.has(next) ? next : fallback;
}

function normalizePriority(value, fallback = "secondaire") {
  const next = asString(value).toLowerCase();
  return PRIORITY_VALUES.has(next) ? next : fallback;
}

function normalizeTime(value) {
  const next = asString(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(next) ? next : "";
}

function normalizeDate(value) {
  const next = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}

function normalizePositiveNumber(value) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return null;
  return Math.round(next * 100) / 100;
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

function normalizeTimeList(value, fallback = []) {
  const list = Array.isArray(value) ? value : fallback;
  const seen = new Set();
  return list
    .map((entry) => normalizeTime(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

function normalizeCategoryDraft(rawValue, fallbackCategoryId = null) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const mode = asString(source.mode).toLowerCase();
  const id = asNullableString(source.id || fallbackCategoryId);
  const label = asNullableString(source.label || source.name);
  if (mode === "suggested") return { mode: "suggested", id, label };
  if (mode === "unresolved") return { mode: "unresolved", id, label };
  if (id) return { mode: "existing", id, label };
  return null;
}

export function normalizeActionDraft(rawValue, fallbackCategoryId = null) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const normalizedTimeSlots = normalizeTimeList(source.timeSlots, source.startTime ? [source.startTime] : []);
  const reminderTimes = normalizeTimeList(
    source.reminderTimes,
    source.reminderTime ? [source.reminderTime] : []
  );
  const quantityPeriod = asString(source.quantityPeriod || "DAY").toUpperCase();
  const notes = asString(source.notes || source.memo || source.habitNotes);
  const repeat = normalizeRepeat(source.repeat, source.oneOffDate ? "none" : "weekly");
  const startTime = normalizeTime(source.startTime);
  return {
    title: asString(source.title),
    categoryId: asNullableString(source.categoryId || fallbackCategoryId),
    outcomeId: asNullableString(source.outcomeId || source.parentId),
    priority: normalizePriority(source.priority),
    repeat,
    oneOffDate: normalizeDate(source.oneOffDate || source.dateKey),
    daysOfWeek: normalizeDaysOfWeek(source.daysOfWeek),
    timeMode: asString(source.timeMode).toUpperCase() === "FIXED" || startTime ? "FIXED" : "NONE",
    startTime,
    timeSlots: normalizedTimeSlots,
    durationMinutes: normalizePositiveNumber(source.durationMinutes || source.durationMin || source.sessionMinutes),
    remindersEnabled:
      normalizeBoolean(source.remindersEnabled, reminderTimes.length > 0 || Boolean(source.windowStart || source.windowEnd)),
    reminderTimes,
    reminderChannel: asString(source.reminderChannel).toUpperCase() === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP",
    windowStart: normalizeTime(source.windowStart || source.reminderWindowStart),
    windowEnd: normalizeTime(source.windowEnd || source.reminderWindowEnd),
    quantityValue: normalizePositiveNumber(source.quantityValue),
    quantityUnit: asString(source.quantityUnit),
    quantityPeriod: QUANTITY_PERIODS.has(quantityPeriod) ? quantityPeriod : "DAY",
    notes,
  };
}

export function normalizeOutcomeDraft(rawValue, fallbackCategoryId = null) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  return {
    title: asString(source.title),
    categoryId: asNullableString(source.categoryId || fallbackCategoryId),
    priority: normalizePriority(source.priority),
    startDate: normalizeDate(source.startDate),
    deadline: normalizeDate(source.deadline),
    measureType: asString(source.measureType),
    targetValue: normalizePositiveNumber(source.targetValue),
    notes: asString(source.notes),
  };
}

export function normalizeCreationProposal(rawValue, fallbackOrigin = null) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  const categoryDraft = normalizeCategoryDraft(source.categoryDraft);
  let actionDrafts = (Array.isArray(source.actionDrafts) ? source.actionDrafts : [])
    .map((draft) => normalizeActionDraft(draft, categoryDraft?.id || null))
    .filter((draft) => draft.title || draft.categoryId);
  const normalizedPrimaryActionRef = normalizePrimaryActionRef(source.primaryActionRef, actionDrafts);
  if (normalizedPrimaryActionRef?.index > 0) {
    const primaryDraft = actionDrafts[normalizedPrimaryActionRef.index];
    actionDrafts = [primaryDraft, ...actionDrafts.filter((_, index) => index !== normalizedPrimaryActionRef.index)];
  }
  const unresolvedQuestions = Array.isArray(source.unresolvedQuestions)
    ? source.unresolvedQuestions.map((entry) => asString(entry)).filter(Boolean)
    : [];
  const normalizedOrigin = normalizeRouteOrigin(source.sourceContext || fallbackOrigin);
  const outcomeDraft = source.outcomeDraft ? normalizeOutcomeDraft(source.outcomeDraft, categoryDraft?.id || null) : null;
  const primaryActionRef = actionDrafts.length ? { index: 0 } : null;
  const fallbackSessionBlueprintDraft = primaryActionRef
    ? buildSessionBlueprintDraft({
        actionDraft: actionDrafts[primaryActionRef.index],
        categoryName: categoryDraft?.label || categoryDraft?.id || "",
      })
    : null;
  return {
    kind: normalizeKind(source.kind, outcomeDraft ? "guided" : actionDrafts.length > 1 ? "assistant" : "assistant"),
    categoryDraft,
    outcomeDraft,
    actionDrafts,
    primaryActionRef,
    sessionBlueprintDraft: primaryActionRef
      ? normalizeSessionBlueprintDraft(source.sessionBlueprintDraft, {
          fallback: fallbackSessionBlueprintDraft,
        })
      : null,
    unresolvedQuestions,
    sourceContext: normalizedOrigin,
    requiresValidation: source.requiresValidation !== false,
  };
}

export function createEmptyCreateItemDraft() {
  return {
    version: 1,
    kind: "action",
    origin: normalizeRouteOrigin(null),
    intent: null,
    proposal: null,
    actionDraft: normalizeActionDraft(null),
    outcomeDraft: normalizeOutcomeDraft(null),
    status: "draft",
  };
}

function deriveLegacyDraft(rawValue) {
  const legacy = rawValue && typeof rawValue === "object" ? rawValue : {};
  const categoryId =
    legacy?.category?.mode === "existing" ? legacy.category.id || null : legacy.pendingCategoryId || null;
  const firstOutcome = Array.isArray(legacy.outcomes) ? legacy.outcomes[0] || null : null;
  const firstHabit = Array.isArray(legacy.habits) ? legacy.habits[0] || null : null;
  const kind = firstOutcome && firstHabit ? "guided" : firstOutcome ? "outcome" : "action";
  return {
    version: 1,
    kind,
    origin: normalizeRouteOrigin({
      mainTab: legacy?.sourceContext?.source === "planning"
        ? "planning"
        : legacy?.sourceContext?.source === "pilotage"
          ? "pilotage"
          : legacy?.sourceContext?.source === "library"
            ? "library"
            : "today",
      sourceSurface: legacy?.sourceContext?.source || "today",
      categoryId,
    }),
    intent: null,
    proposal: null,
    actionDraft: normalizeActionDraft(firstHabit, categoryId),
    outcomeDraft: normalizeOutcomeDraft(firstOutcome, categoryId),
    status: "draft",
  };
}

export function normalizeCreateItemDraft(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : null;
  if (source && ("kind" in source || "proposal" in source || "actionDraft" in source || "outcomeDraft" in source)) {
    return {
      version: 1,
      kind: normalizeKind(source.kind, "action"),
      origin: normalizeRouteOrigin(source.origin),
      intent: source.intent && typeof source.intent === "object" ? { ...source.intent } : null,
      proposal: source.proposal ? normalizeCreationProposal(source.proposal, source.origin) : null,
      actionDraft: normalizeActionDraft(source.actionDraft, source?.proposal?.categoryDraft?.id || null),
      outcomeDraft: normalizeOutcomeDraft(source.outcomeDraft, source?.proposal?.categoryDraft?.id || null),
      status: asString(source.status) || "draft",
    };
  }
  return deriveLegacyDraft(source);
}

export function hasCreateItemDraft(rawValue) {
  const draft = normalizeCreateItemDraft(rawValue);
  if (draft.proposal) return true;
  if (draft.outcomeDraft?.title) return true;
  return Boolean(draft.actionDraft?.title || draft.actionDraft?.categoryId || draft.outcomeDraft?.categoryId);
}

import { USER_AI_CATEGORY_META, USER_AI_GOAL_IDS } from "../../domain/userAiProfile";
import { uid } from "../../utils/helpers";
import {
  addDaysLocal,
  appDowFromDate,
  fromLocalDateKey,
  minutesToTimeStr,
  normalizeLocalDateKey,
  parseTimeToMinutes,
  toLocalDateKey,
} from "../../utils/datetime";
import {
  FIRST_RUN_AI_ASSISTED_SOURCE,
  FIRST_RUN_DETERMINISTIC_SOURCE,
  FIRST_RUN_PLAN_RESPONSE_VERSION,
  FIRST_RUN_PLAN_VARIANTS,
  FIRST_RUN_RECOMMENDED_PLAN_ID,
  FIRST_RUN_RECOMMENDED_PLAN_RESPONSE_VERSION,
  FIRST_RUN_SUPPORTED_PLAN_VARIANTS,
  getFirstRunPlanTitle,
} from "./firstRunPlanContract";

export const FIRST_RUN_VERSION = 1;
export const FIRST_RUN_STATUSES = Object.freeze([
  "intro",
  "why",
  "signals",
  "generate",
  "compare",
  "commit",
  "discovery",
  "done",
]);
export const FIRST_RUN_CAPACITY_OPTIONS = Object.freeze(["reprise", "stable", "forte"]);
export const FIRST_RUN_PLAN_ERROR_CODES = Object.freeze([
  "DISABLED",
  "AUTH_MISSING",
  "AUTH_INVALID",
  "UNAUTHORIZED",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "TIMEOUT",
  "BACKEND_UNAVAILABLE",
  "BACKEND_ERROR",
  "BACKEND_SCHEMA_MISSING",
  "INVALID_RESPONSE",
  "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE",
]);
export const FIRST_RUN_COMMIT_STATUSES = Object.freeze(["idle", "applying", "applied", "failed"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function limitString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLength);
}

function trimString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeIsoString(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeStatus(value, fallback = "intro") {
  const normalized = trimString(value, 32);
  return FIRST_RUN_STATUSES.includes(normalized) ? normalized : fallback;
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

export function createEmptyFirstRunWindow(overrides = {}) {
  return normalizeFirstRunWindow({
    id: uid(),
    daysOfWeek: [],
    startTime: "",
    endTime: "",
    label: "",
    ...(isPlainObject(overrides) ? overrides : {}),
  });
}

export function normalizeFirstRunWindow(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  return {
    id: trimString(source.id, 120) || uid(),
    daysOfWeek: normalizeDaysOfWeek(source.daysOfWeek),
    startTime: normalizeTime(source.startTime),
    endTime: normalizeTime(source.endTime),
    label: limitString(source.label, 80),
  };
}

export function normalizeFirstRunWindows(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => isPlainObject(entry)).map((entry) => normalizeFirstRunWindow(entry));
}

export function addFirstRunDraftWindow(windows, overrides = {}) {
  return [...normalizeFirstRunWindows(windows), createEmptyFirstRunWindow(overrides)];
}

export function patchFirstRunDraftWindow(windows, windowId, patch = {}) {
  const safePatch = isPlainObject(patch) ? patch : {};
  return normalizeFirstRunWindows(windows).map((windowValue) =>
    windowValue?.id === windowId ? normalizeFirstRunWindow({ ...windowValue, ...safePatch }) : windowValue
  );
}

export function removeFirstRunDraftWindow(windows, windowId) {
  return normalizeFirstRunWindows(windows).filter((windowValue) => windowValue?.id !== windowId);
}

function normalizePriorityCategoryIds(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((rawValue) => {
    const normalized = trimString(rawValue, 80);
    if (!normalized || !USER_AI_GOAL_IDS.includes(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out.slice(0, 3);
}

export function normalizeFirstRunDraftAnswers(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    whyText: limitString(source.whyText, 1200),
    primaryGoal: limitString(source.primaryGoal, 240),
    unavailableWindows: normalizeFirstRunWindows(source.unavailableWindows),
    preferredWindows: normalizeFirstRunWindows(source.preferredWindows),
    currentCapacity: FIRST_RUN_CAPACITY_OPTIONS.includes(source.currentCapacity) ? source.currentCapacity : null,
    priorityCategoryIds: normalizePriorityCategoryIds(source.priorityCategoryIds),
  };
}

export function isFirstRunWhyReady(value) {
  return Boolean(trimString(value, 1200));
}

export function isFirstRunSignalsReady(draftAnswers) {
  const source = isPlainObject(draftAnswers) ? draftAnswers : {};
  return Boolean(
    trimString(source.primaryGoal, 240) &&
      FIRST_RUN_CAPACITY_OPTIONS.includes(source.currentCapacity) &&
      normalizePriorityCategoryIds(source.priorityCategoryIds).length
  );
}

function normalizePlanVariant(value, index = 0) {
  const normalized = trimString(value, 32).toLowerCase();
  if (normalized === FIRST_RUN_RECOMMENDED_PLAN_ID) return FIRST_RUN_RECOMMENDED_PLAN_ID;
  if (normalized === "steady") return "tenable";
  if (normalized === "stretch") return "ambitious";
  if (FIRST_RUN_SUPPORTED_PLAN_VARIANTS.includes(normalized)) return normalized;
  return index === 1 ? "ambitious" : "tenable";
}

function normalizePlanComparisonMetrics(value) {
  const source = isPlainObject(value) ? value : {};
  const weeklyMinutes = Number.isFinite(source.weeklyMinutes) ? Math.max(0, Math.round(source.weeklyMinutes)) : 0;
  const totalBlocks =
    Number.isFinite(source.totalBlocks) ? Math.max(0, Math.round(source.totalBlocks))
    : Number.isFinite(source.focusBlocks) ? Math.max(0, Math.round(source.focusBlocks))
    : 0;
  const activeDays = Number.isFinite(source.activeDays) ? Math.max(0, Math.round(source.activeDays)) : 0;
  const recoverySlots = Number.isFinite(source.recoverySlots) ? Math.max(0, Math.round(source.recoverySlots)) : 0;
  const dailyDensity =
    source.dailyDensity === "soutenue" ? "soutenue"
    : typeof source.flexibility === "string" && source.flexibility.toLowerCase() === "high" ? "respirable"
    : "respirable";
  const engagementLevel =
    source.engagementLevel === FIRST_RUN_RECOMMENDED_PLAN_ID ? FIRST_RUN_RECOMMENDED_PLAN_ID
    : source.engagementLevel === "ambitious" ? "ambitious"
    : "tenable";
  return {
    weeklyMinutes,
    totalBlocks,
    activeDays,
    recoverySlots,
    dailyDensity,
    engagementLevel,
  };
}

function normalizePlanCategorySummaryEntry(value) {
  const source = isPlainObject(value) ? value : {};
  const role = source.role === "support" ? "support" : "primary";
  return {
    id: trimString(source.id, 120),
    label: trimString(source.label, 96) || trimString(source.name, 96),
    role,
    blockCount: Number.isFinite(source.blockCount) ? Math.max(0, Math.round(source.blockCount)) : 0,
  };
}

function normalizePlanCategorySummary(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizePlanCategorySummaryEntry(entry))
    .filter((entry) => entry.id && entry.label)
    .slice(0, 6);
}

function normalizePlanPreviewEntry(value) {
  if (typeof value === "string") {
    const title = trimString(value, 160);
    return title
      ? {
          dayKey: "",
          dayLabel: "",
          slotLabel: "",
          categoryId: "",
          categoryLabel: "",
          title,
          minutes: null,
        }
      : null;
  }
  const source = isPlainObject(value) ? value : {};
  const title = trimString(source.title, 160);
  if (!title) return null;
  const minutes = Number.isFinite(source.minutes) ? Math.max(0, Math.round(source.minutes)) : null;
  return {
    dayKey: trimString(source.dayKey, 10),
    dayLabel: trimString(source.dayLabel, 48),
    slotLabel: trimString(source.slotLabel, 48),
    categoryId: trimString(source.categoryId, 120),
    categoryLabel: trimString(source.categoryLabel, 96),
    title,
    minutes,
  };
}

function normalizePlanPreview(value, maxLength = 6) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizePlanPreviewEntry(item))
    .filter(Boolean)
    .slice(0, maxLength);
}

function normalizePlanRationale(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    whyFit: trimString(source.whyFit, 240),
    capacityFit: trimString(source.capacityFit, 240),
    constraintFit: trimString(source.constraintFit, 240),
  };
}

function normalizePlanWeekScheduleEntry(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  const blockCount = Number.isFinite(source.blockCount) ? Math.max(0, Math.round(source.blockCount)) : 0;
  const totalMinutes = Number.isFinite(source.totalMinutes) ? Math.max(0, Math.round(source.totalMinutes)) : 0;
  return {
    dayKey: trimString(source.dayKey, 10),
    dayLabel: trimString(source.dayLabel, 48) || `J+${index}`,
    blockCount,
    totalMinutes,
    loadLabel: trimString(source.loadLabel, 80),
    primarySlotLabel: trimString(source.primarySlotLabel, 80),
    headline: trimString(source.headline, 140),
  };
}

function normalizePlanWeekSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => normalizePlanWeekScheduleEntry(entry, index)).slice(0, 7);
}

function normalizePlanRhythmGuidance(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    title: trimString(source.title, 120),
    description: trimString(source.description, 240),
    startWindow: trimString(source.startWindow, 80),
    shutdownWindow: trimString(source.shutdownWindow, 80),
    confidence: trimString(source.confidence, 40),
  };
}

function normalizeGeneratedPlansAi(value) {
  const source = isPlainObject(value) ? value : {};
  const rawStatus = trimString(source.status, 32);
  const status =
    rawStatus === "idle" ||
    rawStatus === "locked" ||
    rawStatus === "running" ||
    rawStatus === "succeeded" ||
    rawStatus === "timeout" ||
    rawStatus === "failed"
      ? rawStatus
      : "idle";
  const missingInformation = Array.isArray(source.missingInformation)
    ? source.missingInformation.map((entry) => trimString(entry, 80)).filter(Boolean).slice(0, 8)
    : [];
  return {
    status,
    errorCode: trimString(source.errorCode, 80) || null,
    missingInformation,
  };
}

function normalizeCommitDraftCategory(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  return {
    id: trimString(source.id, 120) || `commit_category_${index + 1}`,
    templateId: trimString(source.templateId, 80),
    name: trimString(source.name, 96),
    color: trimString(source.color, 32),
    order: Number.isFinite(source.order) ? Math.max(0, Math.round(source.order)) : index,
  };
}

function normalizeCommitDraftGoal(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  return {
    id: trimString(source.id, 120) || `commit_goal_${index + 1}`,
    categoryId: trimString(source.categoryId, 120),
    title: trimString(source.title, 160),
    type: "OUTCOME",
    order: Number.isFinite(source.order) ? Math.max(0, Math.round(source.order)) : index,
  };
}

function normalizeCommitDraftAction(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  return {
    id: trimString(source.id, 120) || `commit_action_${index + 1}`,
    categoryId: trimString(source.categoryId, 120),
    parentGoalId: trimString(source.parentGoalId, 120) || null,
    title: trimString(source.title, 160),
    type: "PROCESS",
    order: Number.isFinite(source.order) ? Math.max(0, Math.round(source.order)) : index,
    repeat: trimString(source.repeat, 32) || "weekly",
    daysOfWeek: normalizeDaysOfWeek(source.daysOfWeek),
    timeMode: source.timeMode === "FIXED" ? "FIXED" : "NONE",
    startTime: normalizeTime(source.startTime),
    timeSlots: Array.isArray(source.timeSlots)
      ? source.timeSlots.map((value) => normalizeTime(value)).filter(Boolean).slice(0, 7)
      : [],
    durationMinutes: Number.isFinite(source.durationMinutes) ? Math.max(1, Math.round(source.durationMinutes)) : 0,
    sessionMinutes: Number.isFinite(source.sessionMinutes) ? Math.max(1, Math.round(source.sessionMinutes)) : 0,
  };
}

function normalizeCommitDraftOccurrence(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  return {
    id: trimString(source.id, 120) || `commit_occurrence_${index + 1}`,
    actionId: trimString(source.actionId, 120) || trimString(source.goalId, 120),
    date: trimString(source.date, 10),
    start: normalizeTime(source.start),
    durationMinutes: Number.isFinite(source.durationMinutes) ? Math.max(1, Math.round(source.durationMinutes)) : 0,
    status: "planned",
  };
}

function normalizeCommitDraft(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    version: 1,
    categories: Array.isArray(source.categories)
      ? source.categories.map((entry, index) => normalizeCommitDraftCategory(entry, index))
      : [],
    goals: Array.isArray(source.goals) ? source.goals.map((entry, index) => normalizeCommitDraftGoal(entry, index)) : [],
    actions: Array.isArray(source.actions)
      ? source.actions.map((entry, index) => normalizeCommitDraftAction(entry, index))
      : [],
    occurrences: Array.isArray(source.occurrences)
      ? source.occurrences.map((entry, index) => normalizeCommitDraftOccurrence(entry, index))
      : [],
  };
}

function normalizePlanId(source, variant, index = 0) {
  const raw = trimString(source.id, 80);
  if (raw === FIRST_RUN_RECOMMENDED_PLAN_ID || variant === FIRST_RUN_RECOMMENDED_PLAN_ID) {
    return FIRST_RUN_RECOMMENDED_PLAN_ID;
  }
  if (raw === "steady") return "tenable";
  if (raw === "stretch") return "ambitious";
  return raw || (variant === "ambitious" ? "ambitious" : index === 1 ? "ambitious" : "tenable");
}

function normalizeGenerationError(value) {
  if (!isPlainObject(value)) return null;
  const code = trimString(value.code, 80).toUpperCase();
  if (!code || !FIRST_RUN_PLAN_ERROR_CODES.includes(code)) return null;
  return {
    code,
    message: trimString(value.message, 240),
    requestId: trimString(value.requestId, 120) || null,
    backendErrorCode: trimString(value.backendErrorCode, 120).toUpperCase() || null,
    probableCause: trimString(value.probableCause, 120) || null,
    baseUrlUsed: trimString(value.baseUrlUsed, 240) || null,
    originUsed: trimString(value.originUsed, 240) || null,
    details: isPlainObject(value.details) ? value.details : null,
  };
}

function normalizeInputHash(value) {
  return trimString(value, 256) || null;
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((rawValue) => {
    const normalized = trimString(rawValue, 160);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function normalizeCommitStatus(value) {
  const normalized = trimString(value, 32);
  return FIRST_RUN_COMMIT_STATUSES.includes(normalized) ? normalized : "idle";
}

function normalizeCommitV1(value) {
  const source = isPlainObject(value) ? value : {};
  const status = normalizeCommitStatus(source.status);
  return {
    version: 1,
    status,
    commitKey: trimString(source.commitKey, 160) || null,
    selectedPlanId: trimString(source.selectedPlanId, 120) || null,
    selectedPlanType: trimString(source.selectedPlanType, 80) || null,
    selectedPlanSource: trimString(source.selectedPlanSource, 80) || null,
    appliedAt: status === "applied" ? normalizeIsoString(source.appliedAt) : null,
    createdCategoryIds: normalizeIdList(source.createdCategoryIds),
    reusedCategoryIds: normalizeIdList(source.reusedCategoryIds),
    createdGoalIds: normalizeIdList(source.createdGoalIds),
    createdActionIds: normalizeIdList(source.createdActionIds),
    createdOccurrenceIds: normalizeIdList(source.createdOccurrenceIds),
    errorCode: status === "failed" ? trimString(source.errorCode, 80) || "COMMIT_FAILED" : null,
    updatedAt: normalizeIsoString(source.updatedAt),
  };
}

function normalizeGeneratedPlan(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  const variant = normalizePlanVariant(source.variant || source.id, index);
  const comparisonMetrics = normalizePlanComparisonMetrics(source.comparisonMetrics || source.metrics);
  const engagementLevel =
    variant === FIRST_RUN_RECOMMENDED_PLAN_ID ? FIRST_RUN_RECOMMENDED_PLAN_ID
    : variant === "ambitious" ? "ambitious"
    : "tenable";
  return {
    id: normalizePlanId(source, variant, index),
    variant,
    title: trimString(source.title, 120) || getFirstRunPlanTitle(variant),
    summary: trimString(source.summary, 240),
    weekGoal: trimString(source.weekGoal, 180),
    weekBenefit: trimString(source.weekBenefit, 180),
    differenceNote: trimString(source.differenceNote, 180),
    comparisonMetrics: {
      ...comparisonMetrics,
      engagementLevel,
    },
    categories: normalizePlanCategorySummary(source.categories),
    preview: normalizePlanPreview(source.preview, 4),
    todayPreview: normalizePlanPreview(source.todayPreview, 3),
    weekSchedule: normalizePlanWeekSchedule(source.weekSchedule),
    rhythmGuidance: normalizePlanRhythmGuidance(source.rhythmGuidance),
    rationale: normalizePlanRationale(source.rationale),
    commitDraft: normalizeCommitDraft(source.commitDraft),
  };
}

export function normalizeGeneratedPlans(value) {
  if (!isPlainObject(value)) return null;
  const rawPlans =
    Number(value.version) === FIRST_RUN_RECOMMENDED_PLAN_RESPONSE_VERSION && isPlainObject(value.plan)
      ? [value.plan]
      : Array.isArray(value.plans)
        ? value.plans
        : [];
  const safePlans = rawPlans.map((plan, index) => normalizeGeneratedPlan(plan, index));
  if (!safePlans.length) return null;
  return {
    version: Number.isFinite(value.version) ? Math.max(1, Math.round(value.version)) : FIRST_RUN_PLAN_RESPONSE_VERSION,
    source: trimString(value.source, 80) || "local_stub",
    inputHash: normalizeInputHash(value.inputHash),
    generatedAt: normalizeIsoString(value.generatedAt) || new Date().toISOString(),
    requestId: trimString(value.requestId, 120) || null,
    model: trimString(value.model, 120) || null,
    promptVersion: trimString(value.promptVersion, 120) || null,
    ai: normalizeGeneratedPlansAi(value.ai),
    plans: safePlans,
  };
}

function normalizeSelectedPlanId(value, generatedPlans) {
  const rawSelectedPlanId = trimString(value, 80);
  const safePlans = Array.isArray(generatedPlans?.plans) ? generatedPlans.plans : [];
  if (!rawSelectedPlanId) {
    if (safePlans.some((plan) => plan.id === FIRST_RUN_RECOMMENDED_PLAN_ID)) return FIRST_RUN_RECOMMENDED_PLAN_ID;
    if (safePlans.length === 1) return safePlans[0]?.id || null;
    return null;
  }
  const selectedPlanId =
    rawSelectedPlanId === "steady" ? "tenable"
    : rawSelectedPlanId === "stretch" ? "ambitious"
    : rawSelectedPlanId;
  return safePlans.some((plan) => plan.id === selectedPlanId) ? selectedPlanId : null;
}

export function createInitialFirstRunState(overrides = {}, options = {}) {
  const source = isPlainObject(overrides) ? overrides : {};
  const fallbackStatus = options.legacyOnboardingCompleted === true ? "done" : "intro";
  const status = normalizeStatus(source.status, fallbackStatus);
  const generatedPlans = normalizeGeneratedPlans(source.generatedPlans);

  return {
    version: FIRST_RUN_VERSION,
    status,
    draftAnswers: normalizeFirstRunDraftAnswers(source.draftAnswers),
    generatedPlans,
    inputHash: normalizeInputHash(source.inputHash),
    generationError: normalizeGenerationError(source.generationError),
    selectedPlanId: normalizeSelectedPlanId(source.selectedPlanId, generatedPlans),
    commitV1: normalizeCommitV1(source.commitV1),
    discoveryDone: status === "done" ? true : source.discoveryDone === true,
    lastUpdatedAt: normalizeIsoString(source.lastUpdatedAt),
  };
}

export function normalizeFirstRunV1(rawValue, options = {}) {
  return createInitialFirstRunState(rawValue, options);
}

export function isFirstRunDone(ui) {
  const safeUi = isPlainObject(ui) ? ui : {};
  if (isPlainObject(safeUi.firstRunV1)) {
    const firstRun = normalizeFirstRunV1(safeUi.firstRunV1);
    if (firstRun.status !== "done") return false;
    if (isPlainObject(safeUi.firstRunV1.commitV1) && firstRun.commitV1.status !== "applied") return false;
    return true;
  }
  return safeUi.onboardingCompleted === true;
}

export function hasMeaningfulFirstRunState(value) {
  const firstRun = normalizeFirstRunV1(value);
  const draft = firstRun.draftAnswers;

  if (firstRun.status === "done") return false;
  if (firstRun.status !== "intro") return true;
  if (trimString(draft.whyText, 1200) || trimString(draft.primaryGoal, 240) || draft.currentCapacity) return true;
  if (draft.priorityCategoryIds.length) return true;
  if (draft.unavailableWindows.length || draft.preferredWindows.length) return true;
  if (
    firstRun.generatedPlans ||
    firstRun.inputHash ||
    firstRun.generationError ||
    firstRun.selectedPlanId ||
    firstRun.discoveryDone ||
    firstRun.commitV1.status !== "idle"
  ) {
    return true;
  }

  return false;
}

export function getNextFirstRunStatus(status, snapshot = {}) {
  const normalized = normalizeStatus(status);
  if (normalized === "compare" && !trimString(snapshot.selectedPlanId, 80)) return "compare";
  if (normalized === "discovery" && snapshot?.commitV1?.status !== "applied") return "discovery";

  const currentIndex = FIRST_RUN_STATUSES.indexOf(normalized);
  if (currentIndex < 0 || currentIndex >= FIRST_RUN_STATUSES.length - 1) return normalized;
  return FIRST_RUN_STATUSES[currentIndex + 1];
}

export function getPreviousFirstRunStatus(status) {
  const normalized = normalizeStatus(status);
  const currentIndex = FIRST_RUN_STATUSES.indexOf(normalized);
  if (currentIndex <= 0) return "intro";
  return FIRST_RUN_STATUSES[currentIndex - 1];
}

function resolveCategoryLabels(priorityCategoryIds) {
  return priorityCategoryIds
    .map((categoryId) => USER_AI_CATEGORY_META[categoryId]?.label || categoryId)
    .filter(Boolean);
}

function resolvePreferredWindowLabel(windows) {
  const firstWindow = Array.isArray(windows) ? windows[0] : null;
  if (!firstWindow) return "créneaux souples";
  const label = trimString(firstWindow.label, 80);
  if (label) return label;
  const start = normalizeTime(firstWindow.startTime);
  const end = normalizeTime(firstWindow.endTime);
  return start && end ? `${start} - ${end}` : "créneaux souples";
}

function buildPlanPreview({ draftAnswers, variant, weeklyMinutes, focusBlocks }) {
  const categoryLabels = resolveCategoryLabels(draftAnswers.priorityCategoryIds);
  const preferredWindowLabel = resolvePreferredWindowLabel(draftAnswers.preferredWindows);
  const capacityLabel =
    draftAnswers.currentCapacity === "reprise"
      ? "charge légère"
      : draftAnswers.currentCapacity === "forte"
        ? "charge soutenue"
        : "charge équilibrée";

  return [
    `Objectif central: ${draftAnswers.primaryGoal || "premier objectif clarifié"}`,
    `Fenêtre de travail privilégiée: ${preferredWindowLabel}`,
    `${focusBlocks} blocs prévus sur la semaine, ${weeklyMinutes} min au total`,
    categoryLabels.length ? `Catégories suivies: ${categoryLabels.join(", ")}` : `Rythme: ${capacityLabel}`,
    variant === "steady" ? "Marge de récupération préservée" : "Montée en charge plus agressive",
  ].filter(Boolean);
}

function resolveFallbackTodayKey(now) {
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return normalizeLocalDateKey(date) || toLocalDateKey(date);
}

function resolveFallbackCategoryIds(draftAnswers) {
  const ids = Array.isArray(draftAnswers.priorityCategoryIds) ? draftAnswers.priorityCategoryIds : [];
  return ids.length ? ids : ["productivity"];
}

function resolveFallbackStartTime(draftAnswers) {
  const preferredWindows = Array.isArray(draftAnswers.preferredWindows) ? draftAnswers.preferredWindows : [];
  const preferred = preferredWindows.map((windowValue) => normalizeTime(windowValue?.startTime)).find(Boolean);
  return preferred || "00:00";
}

function formatFallbackDayLabel(dateKey, index) {
  const date = fromLocalDateKey(dateKey);
  const fallback = `J+${index}`;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
      .format(date)
      .replace(".", "")
      .toUpperCase();
  } catch {
    return fallback;
  }
}

function buildFallbackDates(todayKey, blockCount) {
  const count = Math.max(1, Math.round(blockCount || 1));
  const offsets = count <= 3 ? [0, 2, 4] : count === 4 ? [0, 1, 3, 5] : [0, 1, 2, 4, 5, 6];
  return offsets.slice(0, count).map((offset) => addDaysLocal(todayKey, offset)).filter(Boolean);
}

function buildFallbackCommitDraft({ draftAnswers, variant, todayKey, focusBlocks, minutesPerBlock }) {
  const categoryIds = resolveFallbackCategoryIds(draftAnswers);
  const categoryId = categoryIds[0] || "productivity";
  const meta = USER_AI_CATEGORY_META[categoryId] || USER_AI_CATEGORY_META.productivity;
  const primaryGoal = trimString(draftAnswers.primaryGoal, 180) || "Installer un premier rythme";
  const startTime = resolveFallbackStartTime(draftAnswers);
  const fixedTime = startTime !== "00:00";
  const dates = buildFallbackDates(todayKey, focusBlocks);
  const daysOfWeek = [];
  dates.forEach((dateKey) => {
    const dow = appDowFromDate(fromLocalDateKey(dateKey));
    if (Number.isInteger(dow) && !daysOfWeek.includes(dow)) daysOfWeek.push(dow);
  });

  const draftCategoryId = `fallback_${variant}_${categoryId}`;
  const draftGoalId = `fallback_${variant}_goal`;
  const draftActionId = `fallback_${variant}_action`;
  const title = variant === "ambitious" ? `Bloc prioritaire: ${primaryGoal}` : `Premier bloc: ${primaryGoal}`;

  const preview = dates.map((dateKey, index) => ({
    dayKey: dateKey,
    dayLabel: formatFallbackDayLabel(dateKey, index),
    slotLabel: fixedTime ? startTime : "Flexible",
    categoryId: draftCategoryId,
    categoryLabel: meta?.label || "Productivité",
    title,
    minutes: minutesPerBlock,
  }));

  return {
    preview,
    todayPreview: preview.slice(0, 1),
    commitDraft: {
      version: 1,
      categories: [
        {
          id: draftCategoryId,
          templateId: categoryId,
          name: meta?.label || "Productivité",
          color: meta?.color || "",
          order: 0,
        },
      ],
      goals: [
        {
          id: draftGoalId,
          categoryId: draftCategoryId,
          title: primaryGoal,
          type: "OUTCOME",
          order: 0,
        },
      ],
      actions: [
        {
          id: draftActionId,
          categoryId: draftCategoryId,
          parentGoalId: draftGoalId,
          title,
          type: "PROCESS",
          order: 0,
          repeat: "weekly",
          daysOfWeek: daysOfWeek.length ? daysOfWeek : [appDowFromDate(fromLocalDateKey(todayKey)) || 1],
          timeMode: fixedTime ? "FIXED" : "NONE",
          startTime: fixedTime ? startTime : "",
          timeSlots: fixedTime ? [startTime] : [],
          durationMinutes: minutesPerBlock,
          sessionMinutes: minutesPerBlock,
        },
      ],
      occurrences: dates.map((dateKey, index) => ({
        id: `fallback_${variant}_occ_${index + 1}`,
        actionId: draftActionId,
        date: dateKey,
        start: fixedTime ? startTime : "00:00",
        durationMinutes: minutesPerBlock,
        status: "planned",
      })),
    },
  };
}

const RECOMMENDED_MISSING_INFORMATION = Object.freeze([
  "Horaires précis",
  "Niveau d’énergie",
  "Habitudes actuelles",
  "Contraintes fixes",
]);

const RECOMMENDED_CAPACITY_CONFIG = Object.freeze({
  reprise: {
    coreMinutes: 25,
    supportMinutes: 20,
    reviewMinutes: 15,
    coreOffsets: [0, 2, 4],
    supportOffsets: [],
    reviewOffsets: [0, 3, 6],
    density: "respirable",
    capacityCopy: "Charge légère pour reprendre sans te griller.",
    actionLimit: 3,
  },
  stable: {
    coreMinutes: 30,
    supportMinutes: 25,
    reviewMinutes: 15,
    coreOffsets: [0, 1, 3, 5],
    supportOffsets: [2, 6],
    reviewOffsets: [0, 3, 6],
    density: "respirable",
    capacityCopy: "Charge réaliste avec une cadence sérieuse et tenable.",
    actionLimit: 4,
  },
  forte: {
    coreMinutes: 45,
    supportMinutes: 30,
    reviewMinutes: 20,
    coreOffsets: [0, 1, 2, 4, 5],
    supportOffsets: [1, 3, 6],
    reviewOffsets: [0, 2, 4, 6],
    density: "soutenue",
    capacityCopy: "Charge plus dense, cohérente avec ta capacité déclarée.",
    actionLimit: 5,
  },
});

const RECOMMENDED_CATEGORY_ACTIONS = Object.freeze({
  health: {
    title: "Mouvement simple",
    description: "Remettre le corps dans le système.",
    anchor: "09:30",
  },
  business: {
    title: "Avancée projet",
    description: "Faire progresser le projet sans dispersion.",
    anchor: "10:00",
  },
  learning: {
    title: "Session d’apprentissage",
    description: "Transformer l’intention en compétence.",
    anchor: "14:00",
  },
  productivity: {
    title: "Organisation du système",
    description: "Clarifier ce qui bloque l’exécution.",
    anchor: "09:00",
  },
  personal: {
    title: "Cadre personnel",
    description: "Stabiliser l’environnement d’exécution.",
    anchor: "18:00",
  },
  finance: {
    title: "Point finances",
    description: "Mettre de la clarté dans les décisions.",
    anchor: "12:30",
  },
});

const GENERIC_RECOMMENDED_TITLE_KEYS = Object.freeze([
  "focus profond",
  "mouvement",
  "mouvement simple",
  "revue du soir",
  "avancee projet",
  "session d apprentissage",
  "organisation du systeme",
  "cadre personnel",
  "point finances",
]);

const RECOMMENDED_CATEGORY_KEYWORDS = Object.freeze({
  app: ["application", "app", "saas", "first access", "first-run", "inscription", "lancement app", "app store"],
  sport: ["sport", "sportive", "sportif", "entrainement", "musculation", "courir", "course", "routine sportive"],
  smoking: ["fumer", "cigarette", "cigarettes", "tabac", "nicotine", "arreter de fumer"],
  launch: ["publier", "lancer", "livrer", "sortir", "avant juin"],
  money: ["argent", "budget", "finance", "revenus", "cash", "facture"],
  learning: ["apprendre", "formation", "cours", "etud", "competence"],
});

const RECOMMENDED_GOAL_CATEGORY_KEYWORDS = Object.freeze({
  health: ["sport", "courir", "course", "5 km", "entrainement", "musculation", "forme", "santé", "energie", "énergie"],
  learning: ["apprendre", "etudier", "étudier", "certification", "aws", "examen", "formation", "cours", "diplome", "diplôme"],
  finance: ["argent", "budget", "finance", "facture", "factures", "impot", "impôt", "revenus", "cash"],
  business: [
    "application",
    "app",
    "saas",
    "produit",
    "lancer",
    "lancement",
    "publier",
    "business",
    "client",
    "job",
    "poste",
    "alternance",
    "offre",
    "coaching",
    "youtube",
    "video",
    "vidéo",
    "contenu",
  ],
  productivity: ["papiers", "administratif", "admin", "organiser", "organisation", "factures", "ranger", "planifier"],
  personal: ["personnel", "routine", "environnement", "stabilité", "stabilite"],
});

function normalizeTextKey(value, maxLength = 1600) {
  return trimString(value, maxLength)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textIncludesAny(value, tokens = []) {
  const normalized = normalizeTextKey(value);
  return Boolean(normalized && tokens.some((token) => normalized.includes(normalizeTextKey(token, 80))));
}

function capitalizeTitle(value) {
  const normalized = trimString(value, 100);
  if (!normalized) return "";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function isGenericRecommendedActionTitle(value) {
  const normalized = normalizeTextKey(value, 160);
  if (!normalized) return true;
  return GENERIC_RECOMMENDED_TITLE_KEYS.some((genericTitle) => normalized === normalizeTextKey(genericTitle, 120));
}

function clampRecommendedDuration(minutes, fallback, { min = 5, max = 75 } = {}) {
  const numeric = Number(minutes);
  const safe = Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  return Math.min(max, Math.max(min, safe));
}

function resolveHintCategoryId(categoryId, categoryIds, fallback = "productivity") {
  const normalized = trimString(categoryId, 80);
  if (normalized && USER_AI_CATEGORY_META[normalized]) return normalized;
  return categoryIds.find((candidate) => USER_AI_CATEGORY_META[candidate]) || fallback;
}

function resolveCadenceOffsets(cadence, fallbackOffsets, todayCandidate = false) {
  const normalized = normalizeTextKey(cadence, 40);
  if (normalized === "once") return [todayCandidate ? 0 : fallbackOffsets[0] ?? 0];
  if (normalized === "twice" || normalized === "2x") return [todayCandidate ? 0 : 1, 3];
  if (normalized === "3x") return [0, 2, 4];
  if (normalized === "daily lite" || normalized === "daily-lite" || normalized === "daily") return [0, 1, 2, 3, 4, 5, 6];
  return Array.isArray(fallbackOffsets) && fallbackOffsets.length ? fallbackOffsets : [0];
}

function buildConcreteActionTitle({ categoryId, primaryGoal, whyText, role = "core" }) {
  const combinedText = `${trimString(primaryGoal, 240)} ${trimString(whyText, 1200)}`;
  const safeGoal = trimString(primaryGoal, 120) || "reprendre le contrôle";

  if (categoryId === "business") {
    if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.app)) {
      if (role === "support") return "Tester inscription + first-run complet";
      if (textIncludesAny(primaryGoal, ["finir", "finaliser", "terminer"])) return "Finaliser l’application";
      if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.launch)) return "Préparer la publication de l’application";
      return "Finaliser l’application";
    }
    return capitalizeTitle(safeGoal);
  }

  if (categoryId === "health") {
    if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.sport)) return "Séance sport légère";
    return "Routine énergie courte";
  }

  if (categoryId === "personal") {
    if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.smoking)) return "Revue anti-cigarette";
    return "Rituel personnel de stabilité";
  }

  if (categoryId === "learning") {
    if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.learning)) return "Session pratique ciblée";
    return "Bloc apprentissage appliqué";
  }

  if (categoryId === "finance") {
    if (textIncludesAny(combinedText, RECOMMENDED_CATEGORY_KEYWORDS.money)) return "Revue finances claire";
    return "Point décisions financières";
  }

  return role === "review" ? "Revue d’exécution" : "Bloc d’exécution prioritaire";
}

function buildConcreteActionDetail({ categoryId, primaryGoal, whyText, title }) {
  const safeGoal = trimString(primaryGoal, 140);
  if (categoryId === "business" && safeGoal) return `Faire avancer: ${safeGoal}.`;
  if (categoryId === "health") return "Installer un bloc corps réaliste, sans dette de motivation.";
  if (categoryId === "personal" && textIncludesAny(whyText, RECOMMENDED_CATEGORY_KEYWORDS.smoking)) {
    return "Identifier le déclencheur, noter l’envie, choisir l’action de remplacement.";
  }
  if (categoryId === "learning") return "Transformer l’intention en pratique observable.";
  if (categoryId === "finance") return "Clarifier une décision utile et la prochaine action.";
  return `${title} sans surcharger la semaine.`;
}

function shortenGoalTitle(value, maxLength = 76) {
  const normalized = trimString(value, 160).replace(/\s+/g, " ");
  if (!normalized) return "le résultat prioritaire";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(20, maxLength - 3)).trim()}...`;
}

function buildPrimaryResultActionTitle(primaryGoal) {
  return `Première avancée : ${shortenGoalTitle(primaryGoal)}`;
}

function buildPrimaryResultActionDetail(primaryGoal, categoryId) {
  const safeGoal = shortenGoalTitle(primaryGoal, 110);
  const categoryLabel = USER_AI_CATEGORY_META[categoryId]?.label;
  return categoryLabel
    ? `Créer une preuve concrète pour ${safeGoal}, avec ${categoryLabel.toLowerCase()} comme contexte.`
    : `Créer une preuve concrète pour ${safeGoal}.`;
}

function goalTextMatchesCategory(goalText, categoryId) {
  const tokens = RECOMMENDED_GOAL_CATEGORY_KEYWORDS[categoryId] || [];
  return textIncludesAny(goalText, tokens);
}

function resolvePrimaryResultCategoryId({ categoryIds, primaryGoal, whyText }) {
  const safeCategoryIds = Array.isArray(categoryIds) && categoryIds.length ? categoryIds : ["productivity"];
  const goalText = trimString(primaryGoal, 240) || trimString(whyText, 1200);
  const priority = ["health", "learning", "finance", "business", "productivity", "personal"];
  const matched = priority.find((categoryId) => safeCategoryIds.includes(categoryId) && goalTextMatchesCategory(goalText, categoryId));
  if (matched) return matched;
  if (safeCategoryIds.includes("business") && !safeCategoryIds.includes("health")) return "business";
  return safeCategoryIds[0] || "productivity";
}

function orderCategoryIdsGoalFirst(categoryIds, primaryCategoryId) {
  const out = [];
  const safePrimary = trimString(primaryCategoryId, 80);
  if (safePrimary) out.push(safePrimary);
  (Array.isArray(categoryIds) ? categoryIds : []).forEach((categoryId) => {
    const normalized = trimString(categoryId, 80);
    if (!normalized || out.includes(normalized)) return;
    out.push(normalized);
  });
  return out.length ? out : ["productivity"];
}

function buildSupportActionTitle(categoryId) {
  if (categoryId === "health") return "Soutien énergie";
  if (categoryId === "personal") return "Stabiliser l’environnement";
  if (categoryId === "business") return "Revue courte du projet";
  if (categoryId === "learning") return "Session d’apprentissage de soutien";
  if (categoryId === "finance") return "Point décisions financières";
  return "Organisation de soutien";
}

function buildSupportActionDetail(categoryId, primaryGoal) {
  const safeGoal = shortenGoalTitle(primaryGoal, 110);
  if (categoryId === "health") return `Préserver l’énergie nécessaire pour avancer sur ${safeGoal}.`;
  if (categoryId === "personal") return `Stabiliser l’environnement autour de ${safeGoal}.`;
  if (categoryId === "business") return `Clarifier rapidement ce qui soutient ${safeGoal}.`;
  if (categoryId === "learning") return `Protéger un apprentissage utile à ${safeGoal}.`;
  if (categoryId === "finance") return `Clarifier une décision financière liée à ${safeGoal}.`;
  return `Réduire le bruit autour de ${safeGoal}.`;
}

function buildDeterministicGoalFirstActionBlueprints({ categoryIds, primaryGoal, whyText, capacityConfig }) {
  const maxActionCount = Math.max(2, Number(capacityConfig.actionLimit) || 3);
  const primaryCategoryId = resolvePrimaryResultCategoryId({ categoryIds, primaryGoal, whyText });
  const orderedCategoryIds = orderCategoryIdsGoalFirst(categoryIds, primaryCategoryId);
  const safePrimaryGoal = trimString(primaryGoal, 180) || "Reprendre le contrôle de ma journée";
  const actions = [
    {
      id: sanitizeIdSegment(`primary_result_${safePrimaryGoal}`),
      categoryId: primaryCategoryId,
      title: buildPrimaryResultActionTitle(safePrimaryGoal),
      detail: buildPrimaryResultActionDetail(safePrimaryGoal, primaryCategoryId),
      durationMinutes: capacityConfig.coreMinutes,
      offsets: capacityConfig.coreOffsets,
      anchor: RECOMMENDED_CATEGORY_ACTIONS[primaryCategoryId]?.anchor || "09:00",
      priority: 100,
      todayCandidate: true,
      primaryResult: true,
    },
  ];

  orderedCategoryIds.forEach((categoryId, index) => {
    if (categoryId === primaryCategoryId || actions.length >= maxActionCount) return;
    const supportOffsets = capacityConfig.supportOffsets.length ? capacityConfig.supportOffsets : [Math.min(6, index + 1)];
    actions.push({
      id: sanitizeIdSegment(`support_${categoryId}_${safePrimaryGoal}`),
      categoryId,
      title: buildSupportActionTitle(categoryId),
      detail: buildSupportActionDetail(categoryId, safePrimaryGoal),
      durationMinutes: categoryId === "health" ? Math.min(25, capacityConfig.supportMinutes) : capacityConfig.supportMinutes,
      offsets: supportOffsets,
      anchor: RECOMMENDED_CATEGORY_ACTIONS[categoryId]?.anchor || "12:30",
      priority: 20,
      todayCandidate: false,
    });
  });

  if (actions.length < maxActionCount) {
    actions.push({
      id: sanitizeIdSegment(`review_${safePrimaryGoal}`),
      categoryId: primaryCategoryId,
      title: "Revue d’exécution",
      detail: `Fermer la boucle sur ${shortenGoalTitle(safePrimaryGoal, 100)} et préparer le prochain bloc.`,
      durationMinutes: capacityConfig.reviewMinutes,
      offsets: capacityConfig.reviewOffsets,
      anchor: "18:30",
      priority: 5,
      todayCandidate: false,
      preferAnchor: true,
    });
  }

  return actions.slice(0, maxActionCount);
}

function normalizeStarterPlanStrategy(starterHints) {
  const source = isPlainObject(starterHints?.planStrategy) ? starterHints.planStrategy : {};
  const reasoningBullets = Array.isArray(source.reasoningBullets)
    ? source.reasoningBullets.map((entry) => trimString(entry, 160)).filter(Boolean).slice(0, 3)
    : [];
  return {
    planTitle: trimString(source.planTitle, 120),
    summary: trimString(source.summary, 240),
    weekGoal: trimString(source.weekGoal, 180),
    weekBenefit: trimString(source.weekBenefit, 180),
    reasoningBullets,
  };
}

function dedupeRecommendedActionBlueprints(actionBlueprints) {
  const seenTitles = new Set();
  const seenIds = new Set();
  return actionBlueprints.filter((action) => {
    const titleKey = normalizeTextKey(action?.title, 120);
    if (!titleKey || seenTitles.has(titleKey)) return false;
    let id = trimString(action.id, 80) || sanitizeIdSegment(action.title);
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${id}_${suffix}`;
      suffix += 1;
    }
    action.id = id;
    seenTitles.add(titleKey);
    seenIds.add(id);
    return true;
  });
}

function buildStarterHintBlueprints({ starterHints, categoryIds, primaryGoal, whyText, capacityConfig }) {
  const rawActionHints = Array.isArray(starterHints?.actionHints) ? starterHints.actionHints : [];
  const rawRiskRituals = Array.isArray(starterHints?.riskRituals) ? starterHints.riskRituals : [];
  const maxActionCount = Math.max(2, Number(capacityConfig.actionLimit) || 3);
  const actionBlueprints = rawActionHints
    .map((hint, index) => {
      if (!isPlainObject(hint)) return null;
      const categoryId = resolveHintCategoryId(hint.categoryId, categoryIds);
      const repairedTitle = buildConcreteActionTitle({ categoryId, primaryGoal, whyText, role: index === 0 ? "core" : "support" });
      const title = isGenericRecommendedActionTitle(hint.title) ? repairedTitle : trimString(hint.title, 90);
      if (!title) return null;
      const fallbackOffsets = index === 0 ? capacityConfig.coreOffsets : capacityConfig.supportOffsets;
      return {
        id: sanitizeIdSegment(hint.id || title || `hint_${index + 1}`),
        categoryId,
        title,
        detail: trimString(hint.purpose, 180) || buildConcreteActionDetail({ categoryId, primaryGoal, whyText, title }),
        durationMinutes: clampRecommendedDuration(
          hint.suggestedDurationMinutes,
          index === 0 ? capacityConfig.coreMinutes : capacityConfig.supportMinutes,
          { min: 10, max: categoryId === "health" ? 45 : 75 }
        ),
        offsets: resolveCadenceOffsets(hint.cadence, fallbackOffsets, hint.todayCandidate === true),
        anchor:
          hint.preferredWindowTag === "evening" ? "18:30"
          : hint.preferredWindowTag === "midday" ? "12:30"
          : hint.preferredWindowTag === "morning" ? "07:30"
          : RECOMMENDED_CATEGORY_ACTIONS[categoryId]?.anchor || "09:00",
        priority: Number.isFinite(hint.priority) ? Math.max(0, Math.round(hint.priority)) : 0,
        todayCandidate: hint.todayCandidate === true,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.todayCandidate !== right.todayCandidate) return left.todayCandidate ? -1 : 1;
      if (left.priority !== right.priority) return right.priority - left.priority;
      return left.title.localeCompare(right.title);
    });

  rawRiskRituals.forEach((ritual, index) => {
    if (!isPlainObject(ritual) || actionBlueprints.length >= maxActionCount) return;
    const categoryId = resolveHintCategoryId(ritual.categoryId, categoryIds, "personal");
    const repairedTitle = buildConcreteActionTitle({ categoryId, primaryGoal, whyText, role: "review" });
    const title = isGenericRecommendedActionTitle(ritual.title) ? repairedTitle : trimString(ritual.title, 90);
    if (!title) return;
    actionBlueprints.push({
      id: sanitizeIdSegment(ritual.id || `ritual_${index + 1}_${title}`),
      categoryId,
      title,
      detail: trimString(ritual.purpose, 180) || buildConcreteActionDetail({ categoryId, primaryGoal, whyText, title }),
      durationMinutes: clampRecommendedDuration(ritual.durationMinutes, capacityConfig.reviewMinutes, { min: 5, max: 20 }),
      offsets: [0, 2, 4, 6],
      anchor: "18:30",
      priority: 1,
      todayCandidate: true,
    });
  });

  return dedupeRecommendedActionBlueprints(actionBlueprints).slice(0, maxActionCount);
}

function resolveRecommendedCategoryIds(draftAnswers) {
  const ids = Array.isArray(draftAnswers.priorityCategoryIds) ? draftAnswers.priorityCategoryIds : [];
  const filtered = ids.filter((categoryId) => USER_AI_CATEGORY_META[categoryId]).slice(0, 3);
  return filtered.length ? filtered : ["productivity"];
}

function resolveRecommendedTodayKey(input, now) {
  const source = isPlainObject(input) ? input : {};
  return normalizeLocalDateKey(source.referenceDateKey) || resolveFallbackTodayKey(now);
}

function resolveRecommendedLocale(input) {
  const source = isPlainObject(input) ? input : {};
  return trimString(source.locale, 32) || "fr-FR";
}

function formatRecommendedDayLabel(dateKey, locale, index) {
  const date = fromLocalDateKey(dateKey);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return `J+${index}`;
  try {
    return new Intl.DateTimeFormat(locale || "fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })
      .format(date)
      .replace(".", "")
      .toUpperCase();
  } catch {
    return formatFallbackDayLabel(dateKey, index);
  }
}

function sanitizeIdSegment(value) {
  return (
    trimString(value, 120)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "item"
  );
}

function buildRecommendedDateKeys(todayKey) {
  return Array.from({ length: 7 }, (_, index) => addDaysLocal(todayKey, index)).filter(Boolean);
}

function windowAppliesToDate(windowValue, dateKey) {
  const date = fromLocalDateKey(dateKey);
  const day = appDowFromDate(date);
  return Number.isInteger(day) && Array.isArray(windowValue?.daysOfWeek) && windowValue.daysOfWeek.includes(day);
}

function normalizeCompleteWindows(windows) {
  return Array.isArray(windows)
    ? windows
        .map((windowValue) => normalizeFirstRunWindow(windowValue))
        .filter((windowValue) => windowValue.startTime && windowValue.endTime && windowValue.daysOfWeek.length)
    : [];
}

function roundUpStartMinutes(minutes, step = 15) {
  if (!Number.isFinite(minutes)) return 0;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 15;
  return Math.ceil(minutes / safeStep) * safeStep;
}

function resolveMinimumStartMinutes({ dateKey, now }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return 0;
  if (normalizeLocalDateKey(dateKey) !== toLocalDateKey(now)) return 0;
  return roundUpStartMinutes(now.getHours() * 60 + now.getMinutes() + 15);
}

function addStartCandidate(candidates, minutes, minStartMinutes = 0) {
  if (!Number.isFinite(minutes)) return;
  const rounded = Math.round(minutes);
  if (rounded < minStartMinutes || rounded < 0 || rounded > 23 * 60 + 59) return;
  const time = minutesToTimeStr(rounded);
  if (time && !candidates.includes(time)) candidates.push(time);
}

function appendDefaultStartCandidates(candidates, anchor, minStartMinutes, { includeMinimum = true } = {}) {
  if (includeMinimum && minStartMinutes > 0) addStartCandidate(candidates, roundUpStartMinutes(minStartMinutes), minStartMinutes);
  [anchor, "07:30", "09:00", "12:30", "18:30", "20:00"].forEach((candidate) => {
    const normalized = normalizeTime(candidate);
    const minutes = parseTimeToMinutes(normalized);
    addStartCandidate(candidates, minutes, minStartMinutes);
  });
}

function buildPreferredStartCandidates({ dateKey, durationMinutes, preferredWindows, anchor, minStartMinutes = 0, preferAnchor = false }) {
  const candidates = [];
  if (preferAnchor) appendDefaultStartCandidates(candidates, anchor, minStartMinutes, { includeMinimum: false });
  preferredWindows.forEach((windowValue) => {
    if (!windowAppliesToDate(windowValue, dateKey)) return;
    const start = parseTimeToMinutes(windowValue.startTime);
    const end = parseTimeToMinutes(windowValue.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    const latestStart = end - durationMinutes;
    const safeStart = roundUpStartMinutes(Math.max(start, minStartMinutes));
    if (latestStart >= safeStart) {
      addStartCandidate(candidates, safeStart, minStartMinutes);
    }
  });
  if (!preferAnchor) appendDefaultStartCandidates(candidates, anchor, minStartMinutes);
  return candidates;
}

function startOverlapsUnavailable({ dateKey, startTime, durationMinutes, unavailableWindows }) {
  const start = parseTimeToMinutes(startTime);
  if (!Number.isFinite(start)) return false;
  const end = start + durationMinutes;
  return unavailableWindows.some((windowValue) => {
    if (!windowAppliesToDate(windowValue, dateKey)) return false;
    const unavailableStart = parseTimeToMinutes(windowValue.startTime);
    const unavailableEnd = parseTimeToMinutes(windowValue.endTime);
    if (!Number.isFinite(unavailableStart) || !Number.isFinite(unavailableEnd) || unavailableEnd <= unavailableStart) {
      return false;
    }
    return start < unavailableEnd && end > unavailableStart;
  });
}

function chooseRecommendedStartTime({ dateKey, durationMinutes, preferredWindows, unavailableWindows, anchor, now, preferAnchor = false }) {
  const minStartMinutes = resolveMinimumStartMinutes({ dateKey, now });
  const candidates = buildPreferredStartCandidates({ dateKey, durationMinutes, preferredWindows, anchor, minStartMinutes, preferAnchor });
  const safeCandidate = candidates.find(
    (candidate) =>
      !startOverlapsUnavailable({
        dateKey,
        startTime: candidate,
        durationMinutes,
        unavailableWindows,
      })
  );
  return safeCandidate || candidates[0] || "09:00";
}

function formatRecommendedSlotLabel(startTime, minutes) {
  const start = parseTimeToMinutes(startTime);
  if (!Number.isFinite(start)) return "Flexible";
  const end = minutesToTimeStr(Math.min(start + Math.max(1, minutes), 23 * 60 + 59));
  return end ? `${startTime} - ${end}` : startTime;
}

function buildRecommendedActionBlueprints({ categoryIds, primaryGoal, whyText, capacityConfig, starterHints = null }) {
  const primaryCategoryId = categoryIds[0] || "productivity";
  const safePrimaryGoal = trimString(primaryGoal, 180) || "Reprendre le contrôle de ma journée";
  const maxActionCount = Math.max(2, Number(capacityConfig.actionLimit) || 3);

  if (!isPlainObject(starterHints)) {
    return buildDeterministicGoalFirstActionBlueprints({
      categoryIds,
      primaryGoal: safePrimaryGoal,
      whyText,
      capacityConfig,
    });
  }

  const actions = buildStarterHintBlueprints({
    starterHints,
    categoryIds,
    primaryGoal: safePrimaryGoal,
    whyText,
    capacityConfig,
  });

  if (!actions.some((action) => action.categoryId === primaryCategoryId)) {
    const title = buildConcreteActionTitle({
      categoryId: primaryCategoryId,
      primaryGoal: safePrimaryGoal,
      whyText,
      role: "core",
    });
    actions.unshift({
      id: sanitizeIdSegment(`core_${title}`),
      categoryId: primaryCategoryId,
      title,
      detail: buildConcreteActionDetail({ categoryId: primaryCategoryId, primaryGoal: safePrimaryGoal, whyText, title }),
      durationMinutes: capacityConfig.coreMinutes,
      offsets: capacityConfig.coreOffsets,
      anchor: "09:00",
      priority: 10,
      todayCandidate: true,
    });
  }

  categoryIds.forEach((categoryId, index) => {
    if (actions.length >= maxActionCount || actions.some((action) => action.categoryId === categoryId)) return;
    const supportAction = RECOMMENDED_CATEGORY_ACTIONS[categoryId] || RECOMMENDED_CATEGORY_ACTIONS.productivity;
    const title = buildConcreteActionTitle({
      categoryId,
      primaryGoal: safePrimaryGoal,
      whyText,
      role: "support",
    });
    const isShortRitual = categoryId === "personal" && textIncludesAny(whyText, RECOMMENDED_CATEGORY_KEYWORDS.smoking);
    const durationMinutes = isShortRitual
      ? Math.min(10, capacityConfig.reviewMinutes)
      : categoryId === "health" && textIncludesAny(whyText, RECOMMENDED_CATEGORY_KEYWORDS.sport)
        ? Math.min(30, capacityConfig.supportMinutes)
        : capacityConfig.supportMinutes;
    const offsets = isShortRitual
      ? capacityConfig.reviewOffsets
      : capacityConfig.supportOffsets.length ? capacityConfig.supportOffsets : [Math.min(6, index + 1)];
    actions.push({
      id: sanitizeIdSegment(`support_${categoryId}_${title}`),
      categoryId,
      title,
      detail: buildConcreteActionDetail({ categoryId, primaryGoal: safePrimaryGoal, whyText, title }) || supportAction.description,
      durationMinutes,
      offsets,
      anchor: supportAction.anchor,
      priority: 5,
      todayCandidate: false,
    });
  });

  if (actions.length < maxActionCount) {
    const title = buildConcreteActionTitle({
      categoryId: primaryCategoryId,
      primaryGoal: safePrimaryGoal,
      whyText,
      role: "review",
    });
    actions.push({
      id: sanitizeIdSegment(`review_${title}`),
      categoryId: primaryCategoryId,
      title: isGenericRecommendedActionTitle(title) ? "Revue d’exécution" : title,
      detail: "Fermer la boucle et préparer le prochain bloc.",
      durationMinutes: capacityConfig.reviewMinutes,
      offsets: capacityConfig.reviewOffsets,
      anchor: "18:30",
      priority: 1,
      todayCandidate: false,
    });
  }

  return dedupeRecommendedActionBlueprints(actions).slice(0, maxActionCount);
}

function buildRecommendedOccurrences({ actionBlueprints, todayKey, preferredWindows, unavailableWindows, locale, categoryMap, now }) {
  const occurrences = [];
  const previewEntries = [];

  actionBlueprints.forEach((action) => {
    action.offsets.forEach((offset) => {
      const dateKey = addDaysLocal(todayKey, offset);
      if (!dateKey) return;
      const start = chooseRecommendedStartTime({
        dateKey,
        durationMinutes: action.durationMinutes,
        preferredWindows,
        unavailableWindows,
        anchor: action.anchor,
        now,
        preferAnchor: action.preferAnchor === true,
      });
      const occurrence = {
        id: `recommended_occ_${action.id}_${offset}`,
        actionId: `recommended_action_${action.id}`,
        date: dateKey,
        start,
        durationMinutes: action.durationMinutes,
        status: "planned",
      };
      occurrences.push(occurrence);
      const category = categoryMap.get(action.categoryId);
      previewEntries.push({
        dayKey: dateKey,
        dayLabel: formatRecommendedDayLabel(dateKey, locale, offset),
        slotLabel: formatRecommendedSlotLabel(start, action.durationMinutes),
        categoryId: category?.id || `recommended_${action.categoryId}`,
        categoryLabel: category?.label || action.categoryId,
        title: action.title,
        minutes: action.durationMinutes,
      });
    });
  });

  occurrences.sort((a, b) => `${a.date}_${a.start}`.localeCompare(`${b.date}_${b.start}`));
  previewEntries.sort((a, b) => `${a.dayKey}_${a.slotLabel}`.localeCompare(`${b.dayKey}_${b.slotLabel}`));
  return { occurrences, previewEntries };
}

function buildRecommendedWeekSchedule({ dateKeys, previewEntries, locale }) {
  return dateKeys.map((dateKey, index) => {
    const dayEntries = previewEntries.filter((entry) => entry.dayKey === dateKey);
    const totalMinutes = dayEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
    const firstEntry = dayEntries[0];
    return {
      dayKey: dateKey,
      dayLabel: formatRecommendedDayLabel(dateKey, locale, index),
      blockCount: dayEntries.length,
      totalMinutes,
      loadLabel:
        dayEntries.length > 1 ? `${dayEntries.length} blocs`
        : dayEntries.length === 1 ? "1 bloc"
        : "Récupération",
      primarySlotLabel: firstEntry?.slotLabel || "",
      headline: firstEntry?.title || "Marge de récupération",
    };
  });
}

function buildRecommendedCommitDraft({ draftAnswers, input, now, starterHints = null }) {
  const safeDraftAnswers = normalizeFirstRunDraftAnswers(draftAnswers);
  const capacity = safeDraftAnswers.currentCapacity || "stable";
  const capacityConfig = RECOMMENDED_CAPACITY_CONFIG[capacity] || RECOMMENDED_CAPACITY_CONFIG.stable;
  const inputCategoryIds = resolveRecommendedCategoryIds(safeDraftAnswers);
  const primaryCategoryId = resolvePrimaryResultCategoryId({
    categoryIds: inputCategoryIds,
    primaryGoal: safeDraftAnswers.primaryGoal,
    whyText: safeDraftAnswers.whyText,
  });
  const categoryIds = orderCategoryIdsGoalFirst(inputCategoryIds, primaryCategoryId);
  const todayKey = resolveRecommendedTodayKey(input, now);
  const locale = resolveRecommendedLocale(input);
  const preferredWindows = normalizeCompleteWindows(safeDraftAnswers.preferredWindows);
  const unavailableWindows = normalizeCompleteWindows(safeDraftAnswers.unavailableWindows);
  const primaryGoal = trimString(safeDraftAnswers.primaryGoal, 180) || "Reprendre le contrôle de ma journée";

  const categories = categoryIds.map((categoryId, index) => {
    const meta = USER_AI_CATEGORY_META[categoryId] || USER_AI_CATEGORY_META.productivity;
    return {
      id: `recommended_${categoryId}`,
      templateId: categoryId,
      name: meta?.label || categoryId,
      color: meta?.color || "",
      order: index,
    };
  });
  const categoryMap = new Map(
    categories.map((category) => [
      category.templateId,
      {
        id: category.id,
        label: category.name,
      },
    ])
  );
  const draftGoalId = `recommended_goal_${sanitizeIdSegment(primaryGoal)}`;
  const actionBlueprints = buildRecommendedActionBlueprints({
    categoryIds,
    primaryGoal,
    whyText: safeDraftAnswers.whyText,
    capacityConfig,
    starterHints,
  });
  const { occurrences, previewEntries } = buildRecommendedOccurrences({
    actionBlueprints,
    todayKey,
    preferredWindows,
    unavailableWindows,
    locale,
    categoryMap,
    now,
  });
  const dateKeys = buildRecommendedDateKeys(todayKey);
  const weekSchedule = buildRecommendedWeekSchedule({ dateKeys, previewEntries, locale });
  const actions = actionBlueprints.map((action, index) => {
    const actionOccurrences = occurrences.filter((occurrence) => occurrence.actionId === `recommended_action_${action.id}`);
    const daysOfWeek = [];
    actionOccurrences.forEach((occurrence) => {
      const day = appDowFromDate(fromLocalDateKey(occurrence.date));
      if (Number.isInteger(day) && !daysOfWeek.includes(day)) daysOfWeek.push(day);
    });
    const startTime = actionOccurrences[0]?.start || "";
    const category = categoryMap.get(action.categoryId) || categoryMap.get(categoryIds[0]);
    return {
      id: `recommended_action_${action.id}`,
      categoryId: category?.id || categories[0]?.id || "recommended_productivity",
      parentGoalId: draftGoalId,
      title: action.title,
      type: "PROCESS",
      order: index,
      repeat: "weekly",
      daysOfWeek: daysOfWeek.length ? daysOfWeek : [appDowFromDate(fromLocalDateKey(todayKey)) || 1],
      timeMode: startTime ? "FIXED" : "NONE",
      startTime,
      timeSlots: startTime ? [startTime] : [],
      durationMinutes: action.durationMinutes,
      sessionMinutes: action.durationMinutes,
    };
  });

  const categoryBlockCounts = new Map();
  previewEntries.forEach((entry) => {
    categoryBlockCounts.set(entry.categoryId, (categoryBlockCounts.get(entry.categoryId) || 0) + 1);
  });

  return {
    categoryIds,
    capacity,
    capacityConfig,
    todayKey,
    locale,
    primaryGoal,
    preferredWindows,
    unavailableWindows,
    categories: categories.map((category) => ({
      id: category.id,
      label: category.name,
      role: category.order === 0 ? "primary" : "support",
      blockCount: categoryBlockCounts.get(category.id) || 0,
    })),
    previewEntries,
    todayPreviewEntries: previewEntries.filter((entry) => entry.dayKey === todayKey).slice(0, 3),
    weekSchedule,
    commitDraft: {
      version: 1,
      categories,
      goals: [
        {
          id: draftGoalId,
          categoryId: categories[0]?.id || "recommended_productivity",
          title: primaryGoal,
          type: "OUTCOME",
          order: 0,
        },
      ],
      actions,
      occurrences,
    },
  };
}

function buildRecommendedGeneratedPlans(input, options = {}) {
  const now = options?.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
  const safeDraftAnswers = normalizeFirstRunDraftAnswers(input);
  const starterHints = isPlainObject(options?.starterHints) ? options.starterHints : null;
  const strategy = normalizeStarterPlanStrategy(starterHints);
  const source = options?.source === FIRST_RUN_AI_ASSISTED_SOURCE ? FIRST_RUN_AI_ASSISTED_SOURCE : FIRST_RUN_DETERMINISTIC_SOURCE;
  const built = buildRecommendedCommitDraft({ draftAnswers: safeDraftAnswers, input, now, starterHints });
  const weeklyMinutes = built.commitDraft.occurrences.reduce(
    (sum, occurrence) => sum + (Number(occurrence.durationMinutes) || 0),
    0
  );
  const activeDays = new Set(built.commitDraft.occurrences.map((occurrence) => occurrence.date).filter(Boolean)).size;
  const firstTodayBlock = built.todayPreviewEntries[0] || built.previewEntries[0] || null;
  const categoryLabels = built.categories.map((category) => category.label).filter(Boolean);
  const preferredCopy = built.preferredWindows.length
    ? "S’appuie sur les créneaux favorables que tu as indiqués."
    : "Démarre avec des horaires sobres, faciles à déplacer après activation.";
  const constraintCopy = built.unavailableWindows.length
    ? "Les indisponibilités déclarées sont évitées autant que possible."
    : "Aucune contrainte bloquante déclarée, donc le plan garde de la marge.";

  return normalizeGeneratedPlans({
    version: FIRST_RUN_RECOMMENDED_PLAN_RESPONSE_VERSION,
    source,
    inputHash: normalizeInputHash(options?.inputHash),
    generatedAt: now.toISOString(),
    plan: {
      id: FIRST_RUN_RECOMMENDED_PLAN_ID,
      variant: FIRST_RUN_RECOMMENDED_PLAN_ID,
      title: "Plan recommandé",
      summary: strategy.summary || "Une première semaine concrète, prête à activer.",
      weekGoal: strategy.weekGoal || built.primaryGoal,
      weekBenefit: strategy.weekBenefit || "Créer une preuve d’exécution dès aujourd’hui.",
      differenceNote:
        source === FIRST_RUN_AI_ASSISTED_SOURCE
          ? "Plan affiné avec l’IA à partir de tes réponses."
          : options?.aiStatus === "timeout" || options?.aiStatus === "failed"
            ? "Aide IA indisponible : plan local fiable généré avec tes réponses."
            : "Plan local construit à partir de tes réponses.",
      comparisonMetrics: {
        weeklyMinutes,
        totalBlocks: built.commitDraft.occurrences.length,
        activeDays,
        recoverySlots: Math.max(0, 7 - activeDays),
        dailyDensity: built.capacityConfig.density,
        engagementLevel: FIRST_RUN_RECOMMENDED_PLAN_ID,
      },
      categories: built.categories,
      preview: built.previewEntries.slice(0, 4),
      todayPreview: (built.todayPreviewEntries.length ? built.todayPreviewEntries : firstTodayBlock ? [firstTodayBlock] : []).slice(0, 3),
      weekSchedule: built.weekSchedule,
      rhythmGuidance: {
        title: "Rythme recommandé",
        description: categoryLabels.length
          ? `Priorité: ${categoryLabels.join(", ")}.`
          : "Priorité: installer le premier système.",
        startWindow: firstTodayBlock?.slotLabel || "Premier créneau disponible",
        shutdownWindow: "Revue courte en fin de journée",
        confidence: built.preferredWindows.length ? "élevée" : "bonne",
      },
      rationale: {
        whyFit:
          strategy.reasoningBullets[0] ||
          (safeDraftAnswers.whyText
            ? "Ton pourquoi sert de point d’ancrage au plan."
            : "Le plan part de ton objectif principal et reste activable immédiatement."),
        capacityFit: built.capacityConfig.capacityCopy,
        constraintFit: strategy.reasoningBullets[1] || `${preferredCopy} ${constraintCopy}`,
      },
      commitDraft: built.commitDraft,
    },
    ai: {
      status:
        source === FIRST_RUN_AI_ASSISTED_SOURCE ? "succeeded"
        : options?.aiStatus === "timeout" || options?.aiStatus === "failed" ? options.aiStatus
        : "locked",
      errorCode: trimString(options?.aiErrorCode, 80) || null,
      missingInformation: RECOMMENDED_MISSING_INFORMATION,
    },
  });
}

export function buildDeterministicRecommendedGeneratedPlans(input, options = {}) {
  return buildRecommendedGeneratedPlans(input, {
    ...options,
    source: FIRST_RUN_DETERMINISTIC_SOURCE,
  });
}

export function buildAiAssistedRecommendedGeneratedPlans(input, starterHints, options = {}) {
  return buildRecommendedGeneratedPlans(input, {
    ...options,
    source: FIRST_RUN_AI_ASSISTED_SOURCE,
    starterHints,
  });
}

export function buildLocalStubGeneratedPlans(draftAnswers, now = new Date()) {
  const safeDraftAnswers = normalizeFirstRunDraftAnswers(draftAnswers);
  const capacity = safeDraftAnswers.currentCapacity || "stable";
  const baseMinutes = capacity === "reprise" ? 120 : capacity === "forte" ? 240 : 180;
  const unavailableCount = safeDraftAnswers.unavailableWindows.length;
  const preferredCount = safeDraftAnswers.preferredWindows.length;

  const steadyMinutes = Math.max(90, baseMinutes - unavailableCount * 20);
  const stretchMinutes = Math.max(steadyMinutes + 45, baseMinutes + 60 - unavailableCount * 10);
  const steadyBlocks = capacity === "reprise" ? 3 : 4;
  const stretchBlocks = capacity === "forte" ? 6 : 5;
  const todayKey = resolveFallbackTodayKey(now);
  const steadyFallback = buildFallbackCommitDraft({
    draftAnswers: safeDraftAnswers,
    variant: "tenable",
    todayKey,
    focusBlocks: steadyBlocks,
    minutesPerBlock: capacity === "reprise" ? 20 : 25,
  });
  const stretchFallback = buildFallbackCommitDraft({
    draftAnswers: safeDraftAnswers,
    variant: "ambitious",
    todayKey,
    focusBlocks: stretchBlocks,
    minutesPerBlock: capacity === "forte" ? 35 : 30,
  });

  return normalizeGeneratedPlans({
    version: FIRST_RUN_PLAN_RESPONSE_VERSION,
    source: "local_fallback",
    generatedAt: now.toISOString(),
    plans: [
      {
        id: "tenable",
        variant: "tenable",
        title: "Plan tenable",
        summary: preferredCount
          ? "Un rythme sobre qui sécurise la régularité dès la première semaine."
          : "Un rythme sobre pour installer une première semaine crédible.",
        metrics: {
          weeklyMinutes: steadyMinutes,
          focusBlocks: steadyBlocks,
          flexibility: "high",
        },
        preview: steadyFallback.preview,
        todayPreview: steadyFallback.todayPreview,
        rationale: {
          whyFit: safeDraftAnswers.whyText ? "Construit à partir de ton pourquoi, sans bloquer l’activation." : "Point de départ local, sans dépendre de l’IA.",
          capacityFit: capacity === "reprise" ? "Charge légère pour relancer sans dette." : "Charge contenue pour créer une première preuve.",
          constraintFit: safeDraftAnswers.unavailableWindows.length ? "Les indisponibilités connues restent évitées autant que possible." : "Plan souple avec une marge d’ajustement.",
        },
        commitDraft: steadyFallback.commitDraft,
        legacyPreview: buildPlanPreview({
          draftAnswers: safeDraftAnswers,
          variant: "tenable",
          weeklyMinutes: steadyMinutes,
          focusBlocks: steadyBlocks,
        }),
      },
      {
        id: "ambitious",
        variant: "ambitious",
        title: "Plan ambitieux",
        summary: "Une version plus dense, avec davantage de blocs et moins de marge.",
        metrics: {
          weeklyMinutes: stretchMinutes,
          focusBlocks: stretchBlocks,
          flexibility: "medium",
        },
        preview: stretchFallback.preview,
        todayPreview: stretchFallback.todayPreview,
        rationale: {
          whyFit: safeDraftAnswers.whyText ? "Même objectif central, avec une cadence plus engagée." : "Version locale plus dense pour tester ton rythme.",
          capacityFit: capacity === "forte" ? "Charge soutenue, cohérente avec ta capacité déclarée." : "Montée en charge plus exigeante que le plan tenable.",
          constraintFit: safeDraftAnswers.preferredWindows.length ? "S’appuie sur les créneaux favorables déclarés." : "À choisir seulement si tu veux moins de marge.",
        },
        commitDraft: stretchFallback.commitDraft,
        legacyPreview: buildPlanPreview({
          draftAnswers: safeDraftAnswers,
          variant: "ambitious",
          weeklyMinutes: stretchMinutes,
          focusBlocks: stretchBlocks,
        }),
      },
    ],
  });
}

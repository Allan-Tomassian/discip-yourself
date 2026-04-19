import { USER_AI_CATEGORY_META, USER_AI_GOAL_IDS } from "../../domain/userAiProfile";
import { uid } from "../../utils/helpers";
import {
  FIRST_RUN_PLAN_RESPONSE_VERSION,
  FIRST_RUN_PLAN_VARIANTS,
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
  "UNAUTHORIZED",
  "NETWORK_ERROR",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "TIMEOUT",
  "BACKEND_ERROR",
  "BACKEND_SCHEMA_MISSING",
  "INVALID_RESPONSE",
  "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function hasMeaningfulWindowFields(windowLike) {
  if (!windowLike || typeof windowLike !== "object") return false;
  return Boolean(
    trimString(windowLike.label, 80) ||
      normalizeTime(windowLike.startTime) ||
      normalizeTime(windowLike.endTime) ||
      normalizeDaysOfWeek(windowLike.daysOfWeek).length
  );
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
    label: trimString(source.label, 80),
  };
}

export function normalizeFirstRunWindows(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => hasMeaningfulWindowFields(entry))
    .map((entry) => normalizeFirstRunWindow(entry));
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
    whyText: trimString(source.whyText, 1200),
    primaryGoal: trimString(source.primaryGoal, 240),
    unavailableWindows: normalizeFirstRunWindows(source.unavailableWindows),
    preferredWindows: normalizeFirstRunWindows(source.preferredWindows),
    currentCapacity: FIRST_RUN_CAPACITY_OPTIONS.includes(source.currentCapacity) ? source.currentCapacity : null,
    priorityCategoryIds: normalizePriorityCategoryIds(source.priorityCategoryIds),
  };
}

function normalizePlanVariant(value, index = 0) {
  const normalized = trimString(value, 32).toLowerCase();
  if (normalized === "steady") return "tenable";
  if (normalized === "stretch") return "ambitious";
  if (FIRST_RUN_PLAN_VARIANTS.includes(normalized)) return normalized;
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
  const engagementLevel = source.engagementLevel === "ambitious" ? "ambitious" : "tenable";
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
    goalId: trimString(source.goalId, 120),
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
    details: isPlainObject(value.details) ? value.details : null,
  };
}

function normalizeInputHash(value) {
  return trimString(value, 256) || null;
}

function normalizeGeneratedPlan(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  const variant = normalizePlanVariant(source.variant || source.id, index);
  const comparisonMetrics = normalizePlanComparisonMetrics(source.comparisonMetrics || source.metrics);
  return {
    id: normalizePlanId(source, variant, index),
    variant,
    title: trimString(source.title, 120) || getFirstRunPlanTitle(variant),
    summary: trimString(source.summary, 240),
    comparisonMetrics: {
      ...comparisonMetrics,
      engagementLevel: variant === "ambitious" ? "ambitious" : "tenable",
    },
    categories: normalizePlanCategorySummary(source.categories),
    preview: normalizePlanPreview(source.preview, 4),
    todayPreview: normalizePlanPreview(source.todayPreview, 3),
    rationale: normalizePlanRationale(source.rationale),
    commitDraft: normalizeCommitDraft(source.commitDraft),
  };
}

export function normalizeGeneratedPlans(value) {
  if (!isPlainObject(value)) return null;
  const safePlans = Array.isArray(value.plans) ? value.plans.map((plan, index) => normalizeGeneratedPlan(plan, index)) : [];
  if (!safePlans.length) return null;
  return {
    version: Number.isFinite(value.version) ? Math.max(1, Math.round(value.version)) : FIRST_RUN_PLAN_RESPONSE_VERSION,
    source: trimString(value.source, 80) || "local_stub",
    inputHash: normalizeInputHash(value.inputHash),
    generatedAt: normalizeIsoString(value.generatedAt) || new Date().toISOString(),
    requestId: trimString(value.requestId, 120) || null,
    model: trimString(value.model, 120) || null,
    promptVersion: trimString(value.promptVersion, 120) || null,
    plans: safePlans,
  };
}

function normalizeSelectedPlanId(value, generatedPlans) {
  const rawSelectedPlanId = trimString(value, 80);
  const selectedPlanId =
    rawSelectedPlanId === "steady" ? "tenable"
    : rawSelectedPlanId === "stretch" ? "ambitious"
    : rawSelectedPlanId;
  if (!selectedPlanId) return null;
  const safePlans = Array.isArray(generatedPlans?.plans) ? generatedPlans.plans : [];
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
    return normalizeFirstRunV1(safeUi.firstRunV1).status === "done";
  }
  return safeUi.onboardingCompleted === true;
}

export function hasMeaningfulFirstRunState(value) {
  const firstRun = normalizeFirstRunV1(value);
  const draft = firstRun.draftAnswers;

  if (firstRun.status === "done") return false;
  if (firstRun.status !== "intro") return true;
  if (draft.whyText || draft.primaryGoal || draft.currentCapacity) return true;
  if (draft.priorityCategoryIds.length) return true;
  if (draft.unavailableWindows.length || draft.preferredWindows.length) return true;
  if (firstRun.generatedPlans || firstRun.inputHash || firstRun.generationError || firstRun.selectedPlanId || firstRun.discoveryDone) {
    return true;
  }

  return false;
}

export function getNextFirstRunStatus(status, snapshot = {}) {
  const normalized = normalizeStatus(status);
  if (normalized === "compare" && !trimString(snapshot.selectedPlanId, 80)) return "compare";

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

  return normalizeGeneratedPlans({
    version: FIRST_RUN_VERSION,
    source: "local_stub",
    generatedAt: now.toISOString(),
    plans: [
      {
        id: "steady",
        variant: "steady",
        title: "Plan tenable",
        summary: preferredCount
          ? "Un rythme sobre qui sécurise la régularité dès la première semaine."
          : "Un rythme sobre pour installer une première semaine crédible.",
        metrics: {
          weeklyMinutes: steadyMinutes,
          focusBlocks: steadyBlocks,
          flexibility: "high",
        },
        preview: buildPlanPreview({
          draftAnswers: safeDraftAnswers,
          variant: "steady",
          weeklyMinutes: steadyMinutes,
          focusBlocks: steadyBlocks,
        }),
      },
      {
        id: "stretch",
        variant: "stretch",
        title: "Plan ambitieux",
        summary: "Une version plus dense, avec davantage de blocs et moins de marge.",
        metrics: {
          weeklyMinutes: stretchMinutes,
          focusBlocks: stretchBlocks,
          flexibility: "medium",
        },
        preview: buildPlanPreview({
          draftAnswers: safeDraftAnswers,
          variant: "stretch",
          weeklyMinutes: stretchMinutes,
          focusBlocks: stretchBlocks,
        }),
      },
    ],
  });
}

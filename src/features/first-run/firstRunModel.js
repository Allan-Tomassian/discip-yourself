import { USER_AI_CATEGORY_META, USER_AI_GOAL_IDS } from "../../domain/userAiProfile";
import { uid } from "../../utils/helpers";
import { addDaysLocal, appDowFromDate, fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey } from "../../utils/datetime";
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

import { APIConnectionTimeoutError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  firstRunCommitDraftSchema,
  firstRunPlanRationaleSchema,
  firstRunPlanResponseSchema,
} from "../../schemas/firstRun.js";
import { hashValue } from "../logging.js";
import { USER_AI_CATEGORY_META } from "../../../../src/domain/userAiProfile.js";
import {
  addDaysLocal,
  appDowFromDate,
  fromLocalDateKey,
  getWeekdayShortLabel,
  minutesToTimeStr,
  normalizeLocalDateKey,
  parseTimeToMinutes,
} from "../../../../src/utils/datetime.js";
import {
  FIRST_RUN_PLAN_VARIANTS,
  getFirstRunPlanTitle,
  serializeFirstRunPlanInput,
} from "../../../../src/features/first-run/firstRunPlanContract.js";

const DEFAULT_FIRST_RUN_PLAN_MODEL = "gpt-5.4";
const DEFAULT_FIRST_RUN_PLAN_TIMEOUT_MS = 55000;
const MIN_FIRST_RUN_PLAN_TIMEOUT_MS = 30000;
const FIRST_RUN_PLAN_PROMPT_VERSION = "first_run_plan_v1";

const firstRunPlanCandidateSchema = z
  .object({
    variant: z.enum(["tenable", "ambitious"]),
    summary: z.string().trim().min(1).max(240),
    rationale: firstRunPlanRationaleSchema,
    commitDraft: firstRunCommitDraftSchema,
  })
  .strict();

const firstRunPlanProviderSchema = z
  .object({
    plans: z.array(firstRunPlanCandidateSchema).length(2),
  })
  .strict();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createBackendError(code, message = code, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function isOpenAiRequestTimeoutError(error) {
  if (error instanceof APIConnectionTimeoutError) return true;
  const name = String(error?.name || "").trim();
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").trim().toLowerCase();
  return (
    name === "APIConnectionTimeoutError" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("request timed out") ||
    message.includes("connection timeout")
  );
}

function formatIssuePath(issue = null) {
  const path = Array.isArray(issue?.path) ? issue.path : [];
  return path
    .map((entry) => String(entry))
    .filter(Boolean)
    .join(".");
}

function buildProviderTimeoutDetails({ timeoutMs = null } = {}) {
  return {
    providerStatus: "timeout",
    rejectionStage: "provider_timeout",
    rejectionReason: "provider_timeout",
    validationPassed: false,
    richnessPassed: false,
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(0, Math.round(timeoutMs)) : null,
  };
}

function buildInvalidResponseDetails(overrides = {}) {
  return {
    providerStatus: "invalid_response",
    rejectionStage: "provider_parse",
    rejectionReason: "provider_parse_failed",
    validationPassed: false,
    richnessPassed: false,
    zodIssuePaths: [],
    ...overrides,
  };
}

function extractTextContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((entry) => (entry?.type === "text" && typeof entry?.text === "string" ? entry.text : ""))
    .filter(Boolean)
    .join("\n");
}

function extractPayloadCandidate(message) {
  if (isPlainObject(message?.parsed)) return message.parsed;
  const rawText = extractTextContent(message?.content);
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveFirstRunPlanOpenAiModel(app) {
  return String(app?.config?.FIRST_RUN_PLAN_OPENAI_MODEL || "").trim() || DEFAULT_FIRST_RUN_PLAN_MODEL;
}

function resolveFirstRunPlanOpenAiTimeoutMs(app) {
  const configuredTimeout = Number(app?.config?.FIRST_RUN_PLAN_OPENAI_TIMEOUT_MS);
  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) return DEFAULT_FIRST_RUN_PLAN_TIMEOUT_MS;
  return Math.max(MIN_FIRST_RUN_PLAN_TIMEOUT_MS, Math.round(configuredTimeout));
}

function buildWeeklyMinuteBands(capacity) {
  if (capacity === "reprise") {
    return {
      tenable: [90, 150],
      ambitious: [150, 210],
    };
  }
  if (capacity === "forte") {
    return {
      tenable: [210, 300],
      ambitious: [315, 420],
    };
  }
  return {
    tenable: [150, 210],
    ambitious: [225, 300],
  };
}

function buildWindowSummary(windows = []) {
  return windows.map((windowValue) => ({
    label: windowValue.label,
    daysOfWeek: windowValue.daysOfWeek,
    startTime: windowValue.startTime,
    endTime: windowValue.endTime,
  }));
}

function buildFirstRunPlanSystemPrompt() {
  return [
    "You create premium first-run weekly plans for Discip Yourself.",
    "Output valid JSON only.",
    "All user-visible text must be in natural French.",
    "Return exactly two variants: one tenable and one ambitious.",
    "Do not add any explanatory wrapper.",
    "Do not mention internal schemas, hidden fields, or the compare screen.",
    "Commit drafts must be committable later without another AI call.",
  ].join("\n");
}

function buildFirstRunPlanPrompt(context) {
  const categoryCatalog = Object.values(USER_AI_CATEGORY_META).map((entry) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
  }));
  const weeklyMinuteBands = buildWeeklyMinuteBands(context.currentCapacity);

  return [
    "Build two first-run weekly plans from the exact user signals below.",
    "Hard requirements:",
    "1. Output exactly two plans with variants tenable and ambitious.",
    "2. Each plan must include summary, rationale, and a commitDraft only.",
    "3. Do not output comparisonMetrics, categories, preview, or todayPreview. They are derived later.",
    "4. commitDraft.categories.templateId must only use ids from priorityCategoryIds.",
    "5. commitDraft.goals must contain OUTCOME items only.",
    "6. commitDraft.actions must contain PROCESS items only.",
    "7. Use concrete scheduled blocks only: actions should use timeMode FIXED with matching startTime and timeSlots[0].",
    "8. commitDraft.occurrences must cover the next 7 days starting at referenceDateKey, inclusive.",
    "9. Never place an occurrence inside unavailableWindows.",
    "10. Prefer preferredWindows when possible, but keep the plan credible.",
    "11. The ambitious plan must be denser than the tenable plan while staying realistic.",
    `12. Weekly minute targets by capacity:
- tenable: ${weeklyMinuteBands.tenable[0]}..${weeklyMinuteBands.tenable[1]}
- ambitious: ${weeklyMinuteBands.ambitious[0]}..${weeklyMinuteBands.ambitious[1]}`,
    "13. Use concise, concrete French. No generic motivational filler.",
    "14. Categories, goals, actions, and occurrences must reference each other consistently by id.",
    "15. Occurrences must use status planned.",
    `Context: ${JSON.stringify({
      whyText: context.whyText,
      primaryGoal: context.primaryGoal,
      currentCapacity: context.currentCapacity,
      priorityCategoryIds: context.priorityCategoryIds,
      categoryCatalog,
      unavailableWindows: buildWindowSummary(context.unavailableWindows),
      preferredWindows: buildWindowSummary(context.preferredWindows),
      referenceDateKey: context.referenceDateKey,
      timezone: context.timezone,
      locale: context.locale,
    })}`,
  ].join("\n");
}

function sortByOrderThenId(left, right) {
  if ((left?.order ?? 0) !== (right?.order ?? 0)) return (left?.order ?? 0) - (right?.order ?? 0);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function sortOccurrences(left, right) {
  const leftDate = normalizeLocalDateKey(left?.date) || "";
  const rightDate = normalizeLocalDateKey(right?.date) || "";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = parseTimeToMinutes(left?.start);
  const rightStart = parseTimeToMinutes(right?.start);
  if (leftStart !== rightStart) return (leftStart ?? 0) - (rightStart ?? 0);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function buildDateHorizon(referenceDateKey) {
  return Array.from({ length: 7 }, (_, index) => addDaysLocal(referenceDateKey, index)).filter(Boolean);
}

function doesOccurrenceOverlapWindow(occurrence, windowValue) {
  const occurrenceDate = fromLocalDateKey(occurrence.date);
  const occurrenceDay = appDowFromDate(occurrenceDate);
  if (!occurrenceDay || !windowValue.daysOfWeek.includes(occurrenceDay)) return false;

  const startMinutes = parseTimeToMinutes(occurrence.start);
  const endMinutes =
    Number.isFinite(startMinutes) && Number.isFinite(occurrence.durationMinutes)
      ? startMinutes + occurrence.durationMinutes
      : null;
  const windowStart = parseTimeToMinutes(windowValue.startTime);
  const windowEnd = parseTimeToMinutes(windowValue.endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    return false;
  }
  return startMinutes < windowEnd && endMinutes > windowStart;
}

function formatDayLabel(dateKey, locale) {
  const date = fromLocalDateKey(dateKey);
  const weekday = getWeekdayShortLabel(date, locale);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${weekday} ${day}/${month}`;
}

function formatSlotLabel(start, durationMinutes) {
  const startMinutes = parseTimeToMinutes(start);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(durationMinutes)) return start;
  const endMinutes = Math.min((startMinutes + durationMinutes), 23 * 60 + 59);
  return `${start} - ${minutesToTimeStr(endMinutes)}`;
}

function buildDerivedView({ variant, summary, rationale, commitDraft, context }) {
  const categories = [...commitDraft.categories].sort(sortByOrderThenId);
  const actions = [...commitDraft.actions].sort(sortByOrderThenId);
  const goals = [...commitDraft.goals].sort(sortByOrderThenId);
  const occurrences = [...commitDraft.occurrences].sort(sortOccurrences);

  const categoriesById = new Map(categories.map((entry) => [entry.id, entry]));
  const actionsById = new Map(actions.map((entry) => [entry.id, entry]));
  const goalsById = new Map(goals.map((entry) => [entry.id, entry]));
  const horizonKeys = new Set(buildDateHorizon(context.referenceDateKey));

  const rows = occurrences
    .filter((occurrence) => horizonKeys.has(occurrence.date))
    .map((occurrence) => {
      const action = actionsById.get(occurrence.goalId);
      const category = categoriesById.get(action?.categoryId || "");
      return {
        occurrence,
        action,
        category,
      };
    });

  const minutesByCategory = new Map();
  const blocksByCategory = new Map();
  const activeDays = new Set();

  rows.forEach(({ occurrence, action, category }) => {
    if (!action || !category) return;
    activeDays.add(occurrence.date);
    minutesByCategory.set(
      category.id,
      (minutesByCategory.get(category.id) || 0) + Math.max(0, Math.round(occurrence.durationMinutes || 0))
    );
    blocksByCategory.set(category.id, (blocksByCategory.get(category.id) || 0) + 1);
  });

  const comparisonMetrics = {
    weeklyMinutes: rows.reduce((sum, row) => sum + Math.max(0, Math.round(row.occurrence.durationMinutes || 0)), 0),
    totalBlocks: rows.length,
    activeDays: activeDays.size,
    recoverySlots: Math.max(0, 7 - activeDays.size),
    dailyDensity: "respirable",
    engagementLevel: variant,
  };

  const blocksByDay = new Map();
  const minutesByDay = new Map();
  rows.forEach(({ occurrence }) => {
    blocksByDay.set(occurrence.date, (blocksByDay.get(occurrence.date) || 0) + 1);
    minutesByDay.set(
      occurrence.date,
      (minutesByDay.get(occurrence.date) || 0) + Math.max(0, Math.round(occurrence.durationMinutes || 0))
    );
  });
  comparisonMetrics.dailyDensity = Array.from(blocksByDay.entries()).some(([dateKey, blockCount]) => {
    return blockCount > 2 || (minutesByDay.get(dateKey) || 0) > 60;
  })
    ? "soutenue"
    : "respirable";

  const dominantCategoryId = [...categories]
    .sort((left, right) => {
      const leftMinutes = minutesByCategory.get(left.id) || 0;
      const rightMinutes = minutesByCategory.get(right.id) || 0;
      if (leftMinutes !== rightMinutes) return rightMinutes - leftMinutes;
      return sortByOrderThenId(left, right);
    })[0]?.id;

  const categorySummary = categories.map((category) => ({
    id: category.id,
    label: category.name,
    role: category.id === dominantCategoryId ? "primary" : "support",
    blockCount: blocksByCategory.get(category.id) || 0,
  }));

  const preview = rows.slice(0, 4).map(({ occurrence, action, category }) => ({
    dayKey: occurrence.date,
    dayLabel: formatDayLabel(occurrence.date, context.locale),
    slotLabel: formatSlotLabel(occurrence.start, occurrence.durationMinutes),
    categoryId: category.id,
    categoryLabel: category.name,
    title: action.title,
    minutes: occurrence.durationMinutes,
  }));

  const todayRows = rows.filter(({ occurrence }) => occurrence.date === context.referenceDateKey);
  const todayPreviewSource = todayRows.length ? todayRows.slice(0, 3) : rows.slice(0, 2);
  const todayPreview = todayPreviewSource.map(({ occurrence, action, category }) => ({
    dayKey: occurrence.date,
    dayLabel: formatDayLabel(occurrence.date, context.locale),
    slotLabel: formatSlotLabel(occurrence.start, occurrence.durationMinutes),
    categoryId: category.id,
    categoryLabel: category.name,
    title: action.title,
    minutes: occurrence.durationMinutes,
  }));

  return {
    id: variant,
    variant,
    title: getFirstRunPlanTitle(variant),
    summary,
    comparisonMetrics,
    categories: categorySummary,
    preview,
    todayPreview,
    rationale,
    commitDraft: {
      ...commitDraft,
      categories,
      goals: [...goalsById.values()].sort(sortByOrderThenId),
      actions: [...actionsById.values()].sort(sortByOrderThenId),
      occurrences,
    },
  };
}

function validateCommitDraft({ variant, commitDraft, context }) {
  const categories = [...commitDraft.categories].sort(sortByOrderThenId);
  const goals = [...commitDraft.goals].sort(sortByOrderThenId);
  const actions = [...commitDraft.actions].sort(sortByOrderThenId);
  const occurrences = [...commitDraft.occurrences].sort(sortOccurrences);

  const categoryIds = new Set();
  const goalIds = new Set();
  const actionIds = new Set();
  const occurrenceIds = new Set();
  const allowedTemplateIds = new Set(context.priorityCategoryIds);
  const horizonKeys = new Set(buildDateHorizon(context.referenceDateKey));

  categories.forEach((category) => {
    if (categoryIds.has(category.id)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "duplicate_category_id",
        })
      );
    }
    categoryIds.add(category.id);
    if (!allowedTemplateIds.has(category.templateId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "category_template_out_of_scope",
        })
      );
    }
  });

  goals.forEach((goal) => {
    if (goalIds.has(goal.id)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "duplicate_goal_id",
        })
      );
    }
    goalIds.add(goal.id);
    if (!categoryIds.has(goal.categoryId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "goal_category_missing",
        })
      );
    }
  });

  actions.forEach((action) => {
    if (actionIds.has(action.id)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "duplicate_action_id",
        })
      );
    }
    actionIds.add(action.id);
    if (!categoryIds.has(action.categoryId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "action_category_missing",
        })
      );
    }
    if (action.parentGoalId && !goalIds.has(action.parentGoalId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "action_parent_goal_missing",
        })
      );
    }
    if (action.timeMode === "FIXED" && action.startTime !== action.timeSlots[0]) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "fixed_action_start_mismatch",
        })
      );
    }
  });

  let previousOccurrence = null;
  occurrences.forEach((occurrence) => {
    if (occurrenceIds.has(occurrence.id)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "duplicate_occurrence_id",
        })
      );
    }
    occurrenceIds.add(occurrence.id);
    if (!actionIds.has(occurrence.goalId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "occurrence_action_missing",
        })
      );
    }
    if (!horizonKeys.has(occurrence.date)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "occurrence_out_of_horizon",
        })
      );
    }
    const action = actions.find((entry) => entry.id === occurrence.goalId);
    const occurrenceDay = appDowFromDate(fromLocalDateKey(occurrence.date));
    if (!action?.daysOfWeek?.includes(occurrenceDay)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "occurrence_day_mismatch",
        })
      );
    }
    if (action.timeMode === "FIXED" && occurrence.start !== action.startTime) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "occurrence_time_mismatch",
        })
      );
    }
    if (context.unavailableWindows.some((windowValue) => doesOccurrenceOverlapWindow(occurrence, windowValue))) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: "commit_draft_validation",
          rejectionReason: "occurrence_overlaps_unavailable_window",
        })
      );
    }

    if (previousOccurrence && previousOccurrence.date === occurrence.date) {
      const previousStart = parseTimeToMinutes(previousOccurrence.start);
      const previousEnd =
        Number.isFinite(previousStart) && Number.isFinite(previousOccurrence.durationMinutes)
          ? previousStart + previousOccurrence.durationMinutes
          : null;
      const currentStart = parseTimeToMinutes(occurrence.start);
      if (Number.isFinite(previousEnd) && Number.isFinite(currentStart) && currentStart < previousEnd) {
        throw createBackendError(
          "INVALID_FIRST_RUN_PLAN_RESPONSE",
          "INVALID_FIRST_RUN_PLAN_RESPONSE",
          buildInvalidResponseDetails({
            rejectionStage: "commit_draft_validation",
            rejectionReason: "overlapping_occurrences",
          })
        );
      }
    }
    previousOccurrence = occurrence;
  });

  const derived = buildDerivedView({
    variant,
    summary: "",
    rationale: { whyFit: "", capacityFit: "", constraintFit: "" },
    commitDraft,
    context,
  });
  const bands = buildWeeklyMinuteBands(context.currentCapacity)[variant];
  const weeklyMinutes = derived.comparisonMetrics.weeklyMinutes;
  if (weeklyMinutes < bands[0] || weeklyMinutes > bands[1]) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: "commit_draft_validation",
        rejectionReason: "weekly_minutes_out_of_band",
        details: { variant, weeklyMinutes, expected: bands },
      })
    );
  }
}

function validatePlanDivergence(plans = []) {
  const tenable = plans.find((plan) => plan.variant === "tenable");
  const ambitious = plans.find((plan) => plan.variant === "ambitious");
  if (!tenable || !ambitious) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: "variant_validation",
        rejectionReason: "missing_required_variants",
      })
    );
  }

  const weeklyGap = ambitious.comparisonMetrics.weeklyMinutes - tenable.comparisonMetrics.weeklyMinutes;
  const minimumWeeklyGap = Math.max(45, Math.round(tenable.comparisonMetrics.weeklyMinutes * 0.2));
  if (weeklyGap < minimumWeeklyGap) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: "variant_divergence",
        rejectionReason: "weekly_minutes_gap_too_small",
      })
    );
  }

  // Weekly load remains the hard guard. Preview rows and recovery days can stay
  // close while still producing a valid, committable compare state.
}

function normalizeProviderPayload(providerPayload, context, requestMeta) {
  const plans = providerPayload.plans
    .map((entry) => {
      validateCommitDraft({ variant: entry.variant, commitDraft: entry.commitDraft, context });
      return buildDerivedView({
        variant: entry.variant,
        summary: entry.summary,
        rationale: entry.rationale,
        commitDraft: entry.commitDraft,
        context,
      });
    })
    .sort((left, right) => FIRST_RUN_PLAN_VARIANTS.indexOf(left.variant) - FIRST_RUN_PLAN_VARIANTS.indexOf(right.variant));

  validatePlanDivergence(plans);

  return firstRunPlanResponseSchema.parse({
    version: 2,
    source: "ai_backend",
    inputHash: requestMeta.inputHash,
    generatedAt: new Date().toISOString(),
    requestId: context.requestId,
    model: requestMeta.model,
    promptVersion: requestMeta.promptVersion,
    plans,
  });
}

async function runOpenAiFirstRunPlan({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("FIRST_RUN_PLAN_BACKEND_UNAVAILABLE");
  }
  const requestModel = resolveFirstRunPlanOpenAiModel(app);
  const requestTimeout = resolveFirstRunPlanOpenAiTimeoutMs(app);
  let completion;
  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.35,
        response_format: zodResponseFormat(firstRunPlanProviderSchema, "first_run_plan_payload"),
        messages: [
          {
            role: "system",
            content: buildFirstRunPlanSystemPrompt(),
          },
          {
            role: "user",
            content: buildFirstRunPlanPrompt(context),
          },
        ],
      },
      { timeout: requestTimeout }
    );
  } catch (error) {
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError(
        "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
        "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
        buildProviderTimeoutDetails({ timeoutMs: requestTimeout })
      );
    }
    throw error;
  }

  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throw createBackendError("INVALID_FIRST_RUN_PLAN_RESPONSE", "INVALID_FIRST_RUN_PLAN_RESPONSE", buildInvalidResponseDetails());
  }
  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError("INVALID_FIRST_RUN_PLAN_RESPONSE", "INVALID_FIRST_RUN_PLAN_RESPONSE", buildInvalidResponseDetails());
  }

  try {
    return {
      candidate: firstRunPlanProviderSchema.parse(candidate),
      model: requestModel,
      promptVersion: FIRST_RUN_PLAN_PROMPT_VERSION,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildInvalidResponseDetails({
          zodIssuePaths: error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 16),
        })
      );
    }
    throw error;
  }
}

export async function runFirstRunPlanService({ app, context }) {
  const inputHash = hashValue(serializeFirstRunPlanInput(context));
  const provider = await runOpenAiFirstRunPlan({ app, context });
  return normalizeProviderPayload(provider.candidate, context, {
    inputHash,
    model: provider.model,
    promptVersion: provider.promptVersion,
  });
}

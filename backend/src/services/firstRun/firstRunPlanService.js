import { APIConnectionTimeoutError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  firstRunCommitDraftOpenAiSchema,
  firstRunCommitDraftProviderSchema,
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
const FIRST_RUN_PLAN_PROMPT_VERSION = "first_run_plan_v2_1";
const MAX_COMMIT_DRAFT_CATEGORIES = 3;
const MAX_COMMIT_DRAFT_GOALS = 4;
const MAX_COMMIT_DRAFT_ACTIONS = 8;
const MAX_COMMIT_DRAFT_OCCURRENCES = 14;
const MAX_WEEKLY_MINUTE_REPAIR_DELTA = 30;
const MIN_REPAIRABLE_OCCURRENCE_DURATION_MINUTES = 15;
const MAX_REPAIRABLE_OCCURRENCE_DURATION_MINUTES = 90;
const ALL_FIRST_RUN_CATEGORY_IDS = Object.freeze(Object.keys(USER_AI_CATEGORY_META));
const FIRST_RUN_CATEGORY_INFERENCE_KEYWORDS = Object.freeze({
  health: ["sante", "sport", "energie", "sommeil", "forme", "marche", "corps", "fatigue", "routine"],
  business: ["business", "projet", "client", "vente", "offre", "roadmap", "produit", "startup", "lancement"],
  learning: ["apprendre", "apprentissage", "etud", "etude", "formation", "cours", "lecture", "competence"],
  productivity: ["discipline", "focus", "concentration", "organisation", "structure", "procrastination", "cadre"],
  personal: ["perso", "personnel", "famille", "maison", "equilibre", "confiance", "vie", "quotidien"],
  finance: ["finance", "argent", "budget", "revenu", "cash", "epargne", "facture", "tresorerie"],
});

const firstRunPlanCandidateSchema = z
  .object({
    variant: z.enum(["tenable", "ambitious"]),
    summary: z.string().trim().min(1).max(240),
    weekGoal: z.string().trim().min(1).max(160),
    weekBenefit: z.string().trim().min(1).max(200),
    differenceNote: z.string().trim().min(1).max(200),
    rationale: firstRunPlanRationaleSchema,
    commitDraft: firstRunCommitDraftProviderSchema,
  })
  .strict();

const firstRunPlanOpenAiCandidateSchema = z
  .object({
    variant: z.enum(["tenable", "ambitious"]),
    summary: z.string().trim().min(1).max(240),
    weekGoal: z.string().trim().min(1).max(160),
    weekBenefit: z.string().trim().min(1).max(200),
    differenceNote: z.string().trim().min(1).max(200),
    rationale: firstRunPlanRationaleSchema,
    commitDraft: firstRunCommitDraftOpenAiSchema,
  })
  .strict();

const firstRunPlanProviderSchema = z
  .object({
    plans: z.array(firstRunPlanCandidateSchema).length(2),
  })
  .strict();

const firstRunPlanOpenAiSchema = z
  .object({
    plans: z.array(firstRunPlanOpenAiCandidateSchema).length(2),
  })
  .strict();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeTextKey(value, maxLength = 240) {
  const normalized = trimString(value, maxLength).toLowerCase();
  if (!normalized) return "";
  return normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeaningfulTokens(value, maxLength = 240) {
  const normalized = normalizeTextKey(value, maxLength);
  if (!normalized) return [];
  const stopwords = new Set([
    "pour",
    "avec",
    "dans",
    "sans",
    "mais",
    "plus",
    "moins",
    "tout",
    "cette",
    "cette",
    "cela",
    "etre",
    "avoir",
    "faire",
    "aller",
    "comme",
    "maintenant",
    "semaine",
    "semaines",
    "prochaines",
    "premiere",
    "vraie",
    "tres",
    "trop",
    "juste",
    "bien",
    "mieux",
    "mon",
    "mes",
    "ton",
    "tes",
    "notre",
    "votre",
    "leur",
    "leurs",
    "reprendre",
    "relancer",
  ]);
  return Array.from(
    new Set(
      normalized
        .split(" ")
        .map((entry) => entry.replace(/[^a-z0-9]/g, ""))
        .filter((entry) => entry.length >= 4 && !stopwords.has(entry))
    )
  ).slice(0, 16);
}

function textIncludesAnyToken(value, tokens = []) {
  const normalized = normalizeTextKey(value, 400);
  if (!normalized || !Array.isArray(tokens) || !tokens.length) return false;
  return tokens.some((token) => normalized.includes(token));
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

function toRoundedInt(value, fallback = null) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function buildRepairDiagnostics(variant) {
  return {
    variant,
    repairedOccurrenceCount: 0,
    repairedMinutesDelta: 0,
  };
}

function appendRepairDiagnostics(details = {}, repairDiagnostics = null) {
  return {
    ...details,
    repairedOccurrenceCount: toRoundedInt(repairDiagnostics?.repairedOccurrenceCount, 0),
    repairedMinutesDelta: toRoundedInt(repairDiagnostics?.repairedMinutesDelta, 0),
  };
}

function sumRepairDiagnostics(items = []) {
  return items.reduce(
    (accumulator, item) => ({
      repairedOccurrenceCount:
        accumulator.repairedOccurrenceCount + Math.max(0, toRoundedInt(item?.repairedOccurrenceCount, 0)),
      repairedMinutesDelta: accumulator.repairedMinutesDelta + toRoundedInt(item?.repairedMinutesDelta, 0),
    }),
    { repairedOccurrenceCount: 0, repairedMinutesDelta: 0 }
  );
}

function pushMapArray(map, key, value) {
  if (!key) return;
  const list = map.get(key) || [];
  list.push(value);
  map.set(key, list);
}

function buildCategoryTitleKey(categoryId, title) {
  const safeCategoryId = trimString(categoryId, 120);
  const safeTitle = normalizeTextKey(title, 160);
  if (!safeCategoryId || !safeTitle) return "";
  return `${safeCategoryId}::${safeTitle}`;
}

function buildOccurrenceRepairIndex(actions = []) {
  const actionsById = new Map();
  const actionsByGoalId = new Map();
  const actionsByTitle = new Map();
  const actionsByCategoryId = new Map();
  const actionsByCategoryAndTitle = new Map();

  actions.forEach((action) => {
    const actionId = trimString(action?.id, 120);
    if (!actionId) return;
    actionsById.set(actionId, action);
    pushMapArray(actionsByCategoryId, trimString(action?.categoryId, 120), action);
    pushMapArray(actionsByGoalId, trimString(action?.parentGoalId, 120), action);

    const titleKey = normalizeTextKey(action?.title, 160);
    if (titleKey) {
      pushMapArray(actionsByTitle, titleKey, action);
      pushMapArray(actionsByCategoryAndTitle, buildCategoryTitleKey(action?.categoryId, action?.title), action);
    }
  });

  return {
    actionsById,
    actionsByGoalId,
    actionsByTitle,
    actionsByCategoryId,
    actionsByCategoryAndTitle,
  };
}

function buildOccurrenceReferenceSnapshot(occurrence = null) {
  const source = isPlainObject(occurrence) ? occurrence : {};
  return {
    occurrenceId: trimString(source.id, 120) || null,
    actionId: trimString(source.actionId, 120) || null,
    goalId: trimString(source.goalId, 120) || null,
    actionTitle: trimString(source.actionTitle || source.title, 160) || null,
    categoryId: trimString(source.categoryId, 120) || null,
  };
}

function listCandidateActionIds(groups = []) {
  return Array.from(
    new Set(
      groups.flatMap((group) => group.actions.map((action) => trimString(action?.id, 120)).filter(Boolean))
    )
  ).slice(0, 12);
}

function intersectIdSets(left, right) {
  return new Set([...left].filter((value) => right.has(value)));
}

function resolveOccurrenceActionReference({ occurrence, repairIndex }) {
  const reference = buildOccurrenceReferenceSnapshot(occurrence);

  if (reference.actionId && repairIndex.actionsById.has(reference.actionId)) {
    return {
      actionId: reference.actionId,
      repaired: false,
      matchedBy: "action_id",
      reference,
      candidateActionIds: [reference.actionId],
    };
  }

  if (reference.goalId && repairIndex.actionsById.has(reference.goalId)) {
    return {
      actionId: reference.goalId,
      repaired: true,
      matchedBy: "legacy_goal_id_as_action_id",
      reference,
      candidateActionIds: [reference.goalId],
    };
  }

  const candidateGroups = [];
  const categoryTitleKey = buildCategoryTitleKey(reference.categoryId, reference.actionTitle);
  const titleKey = normalizeTextKey(reference.actionTitle, 160);

  if (reference.goalId) {
    const actionsForGoal = repairIndex.actionsByGoalId.get(reference.goalId);
    if (Array.isArray(actionsForGoal) && actionsForGoal.length) {
      candidateGroups.push({ label: "goal_id_parent_goal", actions: actionsForGoal });
    }
  }
  if (categoryTitleKey) {
    const actionsForCategoryTitle = repairIndex.actionsByCategoryAndTitle.get(categoryTitleKey);
    if (Array.isArray(actionsForCategoryTitle) && actionsForCategoryTitle.length) {
      candidateGroups.push({ label: "category_title", actions: actionsForCategoryTitle });
    }
  }
  if (titleKey) {
    const actionsForTitle = repairIndex.actionsByTitle.get(titleKey);
    if (Array.isArray(actionsForTitle) && actionsForTitle.length) {
      candidateGroups.push({ label: "title", actions: actionsForTitle });
    }
  }
  if (reference.categoryId) {
    const actionsForCategory = repairIndex.actionsByCategoryId.get(reference.categoryId);
    if (Array.isArray(actionsForCategory) && actionsForCategory.length) {
      candidateGroups.push({ label: "category_unique_action", actions: actionsForCategory });
    }
  }

  if (!candidateGroups.length) {
    return {
      actionId: null,
      repaired: false,
      matchedBy: null,
      reference,
      candidateActionIds: [],
    };
  }

  if (candidateGroups.length === 1 && candidateGroups[0].actions.length === 1) {
    const [resolvedAction] = candidateGroups[0].actions;
    return {
      actionId: resolvedAction.id,
      repaired: true,
      matchedBy: candidateGroups[0].label,
      reference,
      candidateActionIds: [resolvedAction.id],
    };
  }

  const intersectedIds = candidateGroups.reduce((current, group) => {
    const ids = new Set(group.actions.map((action) => action.id));
    return current ? intersectIdSets(current, ids) : ids;
  }, null);

  if (intersectedIds?.size === 1) {
    const [resolvedActionId] = [...intersectedIds];
    return {
      actionId: resolvedActionId,
      repaired: true,
      matchedBy: candidateGroups.map((group) => group.label).join("+"),
      reference,
      candidateActionIds: [resolvedActionId],
    };
  }

  return {
    actionId: null,
    repaired: false,
    matchedBy: null,
    reference,
    candidateActionIds: listCandidateActionIds(candidateGroups),
  };
}

function normalizeCommitDraftReferences({ variant, commitDraft }) {
  const repairIndex = buildOccurrenceRepairIndex(commitDraft.actions);
  const availableActionIds = [...repairIndex.actionsById.keys()].slice(0, 12);
  const repairedOccurrences = [];
  const invalidOccurrenceRefs = [];
  const repairDiagnostics = buildRepairDiagnostics(variant);

  commitDraft.occurrences.forEach((occurrence) => {
    const resolved = resolveOccurrenceActionReference({ occurrence, repairIndex });
    if (!resolved.actionId) {
      invalidOccurrenceRefs.push({
        ...resolved.reference,
        candidateActionIds: resolved.candidateActionIds,
      });
      return;
    }
    if (resolved.repaired) repairDiagnostics.repairedOccurrenceCount += 1;
    repairedOccurrences.push({
      id: occurrence.id,
      actionId: resolved.actionId,
      date: occurrence.date,
      start: occurrence.start,
      durationMinutes: occurrence.durationMinutes,
      status: occurrence.status,
    });
  });

  if (invalidOccurrenceRefs.length) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: "commit_draft_validation",
        rejectionReason: "occurrence_action_missing",
        variant,
        availableActionIds,
        invalidOccurrenceRefs,
        repairedOccurrenceCount: repairDiagnostics.repairedOccurrenceCount,
        repairedMinutesDelta: repairDiagnostics.repairedMinutesDelta,
        rejectedOccurrenceCount: invalidOccurrenceRefs.length,
      })
    );
  }

  return {
    commitDraft: {
      ...commitDraft,
      occurrences: repairedOccurrences,
    },
    repairDiagnostics,
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

function buildCategoryCatalog() {
  return Object.values(USER_AI_CATEGORY_META).map((entry) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
  }));
}

function inferPriorityCategoryIds({ whyText, primaryGoal }) {
  const combinedText = `${trimString(primaryGoal, 240)} ${trimString(whyText, 1200)}`.trim();
  const normalizedText = normalizeTextKey(combinedText, 1800);
  if (!normalizedText) return [];

  const labelTokens = buildCategoryCatalog().flatMap((entry) => [
    [entry.id, normalizeTextKey(entry.id, 80)],
    [entry.id, normalizeTextKey(entry.label, 80)],
  ]);

  const scores = new Map(ALL_FIRST_RUN_CATEGORY_IDS.map((categoryId) => [categoryId, 0]));
  labelTokens.forEach(([categoryId, token]) => {
    if (!token || !normalizedText.includes(token)) return;
    scores.set(categoryId, (scores.get(categoryId) || 0) + 3);
  });

  Object.entries(FIRST_RUN_CATEGORY_INFERENCE_KEYWORDS).forEach(([categoryId, keywords]) => {
    keywords.forEach((keyword) => {
      if (!normalizedText.includes(keyword)) return;
      scores.set(categoryId, (scores.get(categoryId) || 0) + 2);
    });
  });

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .map(([categoryId]) => categoryId)
    .slice(0, 3);
}

function resolvePriorityCategoryHints(context) {
  const explicitHints = Array.isArray(context?.priorityCategoryIds)
    ? context.priorityCategoryIds.filter((entry) => ALL_FIRST_RUN_CATEGORY_IDS.includes(entry))
    : [];
  const inferredHints = inferPriorityCategoryIds({
    whyText: context?.whyText,
    primaryGoal: context?.primaryGoal,
  });
  return {
    explicitHints,
    inferredHints,
    promptHints: explicitHints.length ? explicitHints : inferredHints,
  };
}

function buildFirstRunPlanSystemPrompt() {
  return [
    "You create premium first-run weekly plans for Discip Yourself.",
    "Output valid JSON only.",
    "All user-visible text must be in natural French.",
    "Return exactly two variants: one tenable and one ambitious.",
    "The user gives only a few signals. Infer the rest and organize a credible week.",
    "Commit drafts must stay compact, consistent, and committable later without another AI call.",
    "The whyText must materially influence the weekly goal, weekly benefit, action selection, density, and wording.",
  ].join("\n");
}

function buildFirstRunPlanPrompt(context) {
  const categoryCatalog = buildCategoryCatalog();
  const categoryHints = resolvePriorityCategoryHints(context);
  const weeklyMinuteBands = buildWeeklyMinuteBands(context.currentCapacity);

  return [
    "Build two first-run weekly plans from the exact user signals below.",
    "Hard requirements:",
    "1. Output exactly two plans with variants tenable and ambitious.",
    "2. Each plan must include summary, weekGoal, weekBenefit, differenceNote, rationale, and a commitDraft.",
    "3. Do not output comparisonMetrics, categories, preview, todayPreview, weekSchedule, or rhythmGuidance. They are derived later.",
    "4. priorityCategoryIds are only hints. If they are absent or incomplete, infer the categories from whyText and primaryGoal. Use only category ids from categoryCatalog.",
    `5. Keep each commitDraft compact:
- max ${MAX_COMMIT_DRAFT_CATEGORIES} categories
- max ${MAX_COMMIT_DRAFT_GOALS} goals
- max ${MAX_COMMIT_DRAFT_ACTIONS} actions
- max ${MAX_COMMIT_DRAFT_OCCURRENCES} occurrences
- prefer one canonical fixed slot per action with exactly one timeSlots entry`,
    "6. commitDraft.goals must contain OUTCOME items only. commitDraft.actions must contain PROCESS items only.",
    "7. Every FIXED action must have one canonical startTime. Each occurrence must use the exact actionId and the exact same start as its action.startTime.",
    "8. commitDraft.occurrences must cover only the next 7 days starting at referenceDateKey, inclusive, with status planned.",
    "9. Never place an occurrence inside unavailableWindows. Prefer preferredWindows when possible, but keep the plan credible.",
    "10. The ambitious plan must be denser than the tenable plan, with a structural difference in load, active days, margin, or cadence.",
    `11. Weekly minute targets by capacity:
- tenable: ${weeklyMinuteBands.tenable[0]}..${weeklyMinuteBands.tenable[1]}
- ambitious: ${weeklyMinuteBands.ambitious[0]}..${weeklyMinuteBands.ambitious[1]}`,
    "12. Use concise, concrete French. No generic motivational filler.",
    "13. weekGoal must state what the user should have moved forward by the end of the week.",
    "14. weekBenefit must describe a concrete visible benefit at J+7. It must not be generic.",
    "15. differenceNote must state what clearly changes versus the other plan: load, active days, margin, cadence, or timing.",
    "16. The tenable plan must preserve margin with at least one lighter day. The ambitious plan must push harder without becoming unrealistic.",
    `Context: ${JSON.stringify({
      whyText: context.whyText,
      primaryGoal: context.primaryGoal,
      currentCapacity: context.currentCapacity,
      priorityCategoryIdsHint: categoryHints.explicitHints,
      inferredCategoryIdsHint: categoryHints.inferredHints,
      resolvedCategoryHints: categoryHints.promptHints,
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

function doesOccurrenceMatchPreferredWindow(occurrence, preferredWindows = []) {
  return preferredWindows.some((windowValue) => doesOccurrenceOverlapWindow(occurrence, windowValue));
}

function buildChronologicalOccurrences(occurrences = []) {
  return [...occurrences].sort(sortOccurrences);
}

function buildCanonicalActionTimeCandidates(action) {
  return Array.from(
    new Set(
      [action?.startTime, ...(Array.isArray(action?.timeSlots) ? action.timeSlots : [])]
        .map((value) => trimString(value, 16))
        .filter((value) => Number.isFinite(parseTimeToMinutes(value)))
    )
  ).slice(0, 3);
}

function resolveCanonicalActionStart({ action, occurrences, context }) {
  const candidates = buildCanonicalActionTimeCandidates(action);
  if (!candidates.length) return null;

  const safeCandidates = candidates
    .map((candidateStart) => {
      const preferredMatches = occurrences.reduce(
        (count, occurrence) =>
          count +
          (doesOccurrenceMatchPreferredWindow({ ...occurrence, start: candidateStart }, context.preferredWindows) ? 1 : 0),
        0
      );
      const overlapsUnavailable = occurrences.some((occurrence) =>
        context.unavailableWindows.some((windowValue) =>
          doesOccurrenceOverlapWindow({ ...occurrence, start: candidateStart }, windowValue)
        )
      );
      if (overlapsUnavailable) return null;
      return {
        start: candidateStart,
        preferredMatches,
        isCurrent: candidateStart === action.startTime,
      };
    })
    .filter(Boolean);

  if (!safeCandidates.length) return null;
  safeCandidates.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
    if (left.preferredMatches !== right.preferredMatches) return right.preferredMatches - left.preferredMatches;
    return left.start.localeCompare(right.start);
  });
  return safeCandidates[0]?.start || null;
}

function normalizeActionTimeSlots(action, resolvedStart) {
  const orderedSlots = [resolvedStart, ...(Array.isArray(action?.timeSlots) ? action.timeSlots : [])]
    .map((value) => trimString(value, 16))
    .filter(Boolean);
  return Array.from(new Set(orderedSlots)).slice(0, 1);
}

function repairCommitDraftTimeCoherence({ commitDraft, context, repairDiagnostics }) {
  const repairedActions = [...commitDraft.actions];
  const repairedOccurrences = buildChronologicalOccurrences(commitDraft.occurrences).map((occurrence) => ({ ...occurrence }));
  const occurrencesByActionId = new Map();

  repairedOccurrences.forEach((occurrence) => {
    pushMapArray(occurrencesByActionId, trimString(occurrence.actionId, 120), occurrence);
  });

  repairedActions.forEach((action, index) => {
    if (action?.timeMode !== "FIXED") return;
    const actionOccurrences = occurrencesByActionId.get(trimString(action?.id, 120)) || [];
    if (!actionOccurrences.length) return;
    const resolvedStart = resolveCanonicalActionStart({
      action,
      occurrences: actionOccurrences,
      context,
    });
    if (!resolvedStart) return;
    if (resolvedStart !== action.startTime || action.timeSlots[0] !== resolvedStart || action.timeSlots.length !== 1) {
      repairedActions[index] = {
        ...action,
        startTime: resolvedStart,
        timeSlots: normalizeActionTimeSlots(action, resolvedStart),
      };
    }
  });

  const repairedActionsById = new Map(repairedActions.map((action) => [action.id, action]));
  const synchronizedOccurrences = repairedOccurrences.map((occurrence) => {
    const action = repairedActionsById.get(occurrence.actionId);
    if (!action || action.timeMode !== "FIXED" || occurrence.start === action.startTime) return occurrence;
    repairDiagnostics.repairedOccurrenceCount += 1;
    return {
      ...occurrence,
      start: action.startTime,
    };
  });

  return {
    ...commitDraft,
    actions: repairedActions,
    occurrences: synchronizedOccurrences,
  };
}

function canResizeOccurrenceWithinSchedule({
  occurrence,
  nextOccurrence = null,
  nextDurationMinutes,
  context,
}) {
  if (!Number.isFinite(nextDurationMinutes)) return false;
  const safeDuration = Math.round(nextDurationMinutes);
  if (
    safeDuration < MIN_REPAIRABLE_OCCURRENCE_DURATION_MINUTES ||
    safeDuration > MAX_REPAIRABLE_OCCURRENCE_DURATION_MINUTES
  ) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(occurrence.start);
  if (!Number.isFinite(startMinutes)) return false;
  const endMinutes = startMinutes + safeDuration;
  if (endMinutes > 23 * 60 + 59) return false;

  const candidateOccurrence = {
    ...occurrence,
    durationMinutes: safeDuration,
  };
  if (context.unavailableWindows.some((windowValue) => doesOccurrenceOverlapWindow(candidateOccurrence, windowValue))) {
    return false;
  }

  if (nextOccurrence && nextOccurrence.date === occurrence.date) {
    const nextStartMinutes = parseTimeToMinutes(nextOccurrence.start);
    if (Number.isFinite(nextStartMinutes) && endMinutes > nextStartMinutes) return false;
  }

  return true;
}

function repairWeeklyMinuteBand({ variant, commitDraft, context, repairDiagnostics }) {
  const derived = buildDerivedView({
    variant,
    summary: "",
    weekGoal: "objectif de semaine",
    weekBenefit: "benefice concret a j+7",
    differenceNote: "difference structurelle de semaine",
    rationale: { whyFit: "", capacityFit: "", constraintFit: "" },
    commitDraft,
    context,
  });
  const bands = buildWeeklyMinuteBands(context.currentCapacity)[variant];
  const weeklyMinutes = derived.comparisonMetrics.weeklyMinutes;
  if (weeklyMinutes >= bands[0] && weeklyMinutes <= bands[1]) {
    return { commitDraft, weeklyMinutes };
  }

  const delta = weeklyMinutes < bands[0] ? bands[0] - weeklyMinutes : weeklyMinutes - bands[1];
  if (delta > MAX_WEEKLY_MINUTE_REPAIR_DELTA) {
    return { commitDraft, weeklyMinutes };
  }

  const chronologicalOccurrences = buildChronologicalOccurrences(commitDraft.occurrences);
  for (let index = chronologicalOccurrences.length - 1; index >= 0; index -= 1) {
    const occurrence = chronologicalOccurrences[index];
    const nextOccurrence = chronologicalOccurrences[index + 1] || null;
    const targetDuration =
      weeklyMinutes < bands[0] ? occurrence.durationMinutes + delta : occurrence.durationMinutes - delta;
    if (
      !canResizeOccurrenceWithinSchedule({
        occurrence,
        nextOccurrence,
        nextDurationMinutes: targetDuration,
        context,
      })
    ) {
      continue;
    }

    repairDiagnostics.repairedMinutesDelta += weeklyMinutes < bands[0] ? delta : -delta;
    return {
      commitDraft: {
        ...commitDraft,
        occurrences: commitDraft.occurrences.map((entry) =>
          entry.id === occurrence.id
            ? {
                ...entry,
                durationMinutes: targetDuration,
              }
            : entry
        ),
      },
      weeklyMinutes,
    };
  }

  return { commitDraft, weeklyMinutes };
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

function formatMinuteRange(startMinutes, endMinutes) {
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return "";
  const safeStart = Math.max(0, Math.round(startMinutes));
  const safeEnd = Math.max(safeStart + 15, Math.min(23 * 60 + 59, Math.round(endMinutes)));
  return `${minutesToTimeStr(safeStart)} - ${minutesToTimeStr(safeEnd)}`;
}

function classifyDayLoad(totalMinutes, blockCount) {
  if (blockCount <= 0 || totalMinutes <= 20) return "leger";
  if (blockCount >= 2 || totalMinutes >= 75) return "dense";
  return "cadre";
}

function buildWeekScheduleHeadline(dayRows = []) {
  if (!dayRows.length) return "Journée légère pour garder de la marge.";

  const dominantCategory = [...dayRows]
    .sort((left, right) => {
      const leftMinutes = Math.max(0, Math.round(left?.occurrence?.durationMinutes || 0));
      const rightMinutes = Math.max(0, Math.round(right?.occurrence?.durationMinutes || 0));
      if (leftMinutes !== rightMinutes) return rightMinutes - leftMinutes;
      return String(left?.action?.title || "").localeCompare(String(right?.action?.title || ""));
    })[0]?.category;

  if (dayRows.length === 1) {
    return `Bloc clé ${dominantCategory?.name?.toLowerCase?.() || "utile"}: ${dayRows[0]?.action?.title || "avancée prioritaire"}.`;
  }

  return `${dayRows.length} blocs pour faire avancer ${dominantCategory?.name?.toLowerCase?.() || "la semaine"}.`;
}

function buildWeekSchedule({ rows, context, horizonKeys }) {
  const rowsByDay = new Map(horizonKeys.map((dateKey) => [dateKey, []]));
  rows.forEach((row) => {
    if (!rowsByDay.has(row?.occurrence?.date)) return;
    rowsByDay.get(row.occurrence.date).push(row);
  });

  return [...rowsByDay.entries()].map(([dateKey, dayRows]) => {
    const sortedRows = [...dayRows].sort((left, right) => sortOccurrences(left?.occurrence, right?.occurrence));
    const blockCount = sortedRows.length;
    const totalMinutes = sortedRows.reduce(
      (sum, row) => sum + Math.max(0, Math.round(row?.occurrence?.durationMinutes || 0)),
      0
    );
    const firstRow = sortedRows[0] || null;
    return {
      dayKey: dateKey,
      dayLabel: formatDayLabel(dateKey, context.locale),
      blockCount,
      totalMinutes,
      loadLabel: classifyDayLoad(totalMinutes, blockCount),
      primarySlotLabel:
        firstRow ? formatSlotLabel(firstRow.occurrence.start, firstRow.occurrence.durationMinutes) : "Marge protégée",
      headline: buildWeekScheduleHeadline(sortedRows),
    };
  });
}

function buildRhythmGuidance({ rows, preferredWindows = [] }) {
  const daySummaries = new Map();
  rows.forEach((row) => {
    const dateKey = row?.occurrence?.date;
    const startMinutes = parseTimeToMinutes(row?.occurrence?.start);
    const endMinutes =
      Number.isFinite(startMinutes) && Number.isFinite(row?.occurrence?.durationMinutes)
        ? startMinutes + row.occurrence.durationMinutes
        : null;
    if (!dateKey || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return;
    const current = daySummaries.get(dateKey) || {
      firstStart: startMinutes,
      lastEnd: endMinutes,
      rows: [],
    };
    current.firstStart = Math.min(current.firstStart, startMinutes);
    current.lastEnd = Math.max(current.lastEnd, endMinutes);
    current.rows.push(row);
    daySummaries.set(dateKey, current);
  });

  const dayValues = [...daySummaries.values()];
  if (dayValues.length < 3) return null;

  const startValues = dayValues.map((entry) => entry.firstStart);
  const endValues = dayValues.map((entry) => entry.lastEnd);
  const minStart = Math.min(...startValues);
  const maxStart = Math.max(...startValues);
  const minEnd = Math.min(...endValues);
  const maxEnd = Math.max(...endValues);
  const startSpread = maxStart - minStart;
  const endSpread = maxEnd - minEnd;
  const preferredMatches = rows.filter((row) =>
    preferredWindows.some((windowValue) => doesOccurrenceOverlapWindow(row?.occurrence, windowValue))
  ).length;

  const confidence =
    dayValues.length >= 4 && startSpread <= 60 && endSpread <= 90 ? "high"
    : dayValues.length >= 3 && (startSpread <= 90 || preferredMatches >= 2) ? "medium"
    : "low";

  if (confidence === "low") return null;

  return {
    startWindow: formatMinuteRange(minStart, minStart + Math.max(45, Math.min(90, startSpread + 45))),
    shutdownWindow: formatMinuteRange(maxEnd, maxEnd + Math.max(30, Math.min(60, endSpread + 30))),
    confidence,
    label: "Fenêtres conseillées pour lancer et refermer la journée",
    note:
      preferredMatches > 0
        ? "Ces repères s'appuient sur les créneaux déjà favorables et sur le rythme réellement planifié."
        : "Ces repères s'appuient sur le rythme réellement planifié cette semaine.",
  };
}

function buildPlanReferenceTokens(plan) {
  const categoryTokens = (Array.isArray(plan?.categories) ? plan.categories : []).flatMap((entry) =>
    extractMeaningfulTokens(entry?.label, 96)
  );
  const actionTokens = (Array.isArray(plan?.commitDraft?.actions) ? plan.commitDraft.actions : []).flatMap((entry) =>
    extractMeaningfulTokens(entry?.title, 160)
  );
  const goalTokens = (Array.isArray(plan?.commitDraft?.goals) ? plan.commitDraft.goals : []).flatMap((entry) =>
    extractMeaningfulTokens(entry?.title, 160)
  );
  return Array.from(new Set([...categoryTokens, ...actionTokens, ...goalTokens])).slice(0, 18);
}

function buildPlanDiagnostics(plan) {
  const weekSchedule = Array.isArray(plan?.weekSchedule) ? plan.weekSchedule : [];
  return {
    retainedCategoryIds: (Array.isArray(plan?.commitDraft?.categories) ? plan.commitDraft.categories : []).map(
      (category) => category.templateId
    ),
    activeDays: Number(plan?.comparisonMetrics?.activeDays || 0),
    lightDays: weekSchedule.filter((entry) => entry?.loadLabel === "leger").length,
    denseDays: weekSchedule.filter((entry) => entry?.loadLabel === "dense").length,
    hasRhythmGuidance: Boolean(plan?.rhythmGuidance),
    rhythmGuidanceConfidence: plan?.rhythmGuidance?.confidence || null,
  };
}

function hasGroundedPlanText(text, { intentTokens = [], planTokens = [] } = {}) {
  if (textIncludesAnyToken(text, intentTokens)) return true;
  if (textIncludesAnyToken(text, planTokens)) return true;
  return /\b\d+\b/.test(trimString(text, 240));
}

function hasSpecificDifferenceNote(text) {
  const normalized = normalizeTextKey(text, 200);
  if (!normalized) return false;
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 5) return false;
  return ["plus", "moins", "jour", "jours", "blocs", "marge", "charge", "dense", "leger", "cadre", "rythme"].some(
    (token) => normalized.includes(token)
  );
}

function rejectPlanQuality(reason, { variant, plan, diagnostics, extraDetails = null }) {
  throw createBackendError(
    "INVALID_FIRST_RUN_PLAN_RESPONSE",
    "INVALID_FIRST_RUN_PLAN_RESPONSE",
    buildInvalidResponseDetails({
      rejectionStage: "plan_quality",
      rejectionReason: reason,
      variant,
      retainedCategoryIds: diagnostics?.retainedCategoryIds || null,
      activeDays: diagnostics?.activeDays ?? null,
      lightDays: diagnostics?.lightDays ?? null,
      denseDays: diagnostics?.denseDays ?? null,
      hasRhythmGuidance: diagnostics?.hasRhythmGuidance ?? null,
      rhythmGuidanceConfidence: diagnostics?.rhythmGuidanceConfidence ?? null,
      ...(extraDetails ? { details: extraDetails } : {}),
    })
  );
}

function validatePlanQuality({ plan, context }) {
  const diagnostics = buildPlanDiagnostics(plan);
  const intentTokens = extractMeaningfulTokens(`${context.primaryGoal} ${context.whyText}`, 1600);
  const planTokens = buildPlanReferenceTokens(plan);
  const weekSchedule = Array.isArray(plan.weekSchedule) ? plan.weekSchedule : [];
  const minimumActiveDays = plan.variant === "ambitious" ? 5 : 4;

  if (weekSchedule.length < 5 || Number(plan?.comparisonMetrics?.activeDays || 0) < minimumActiveDays) {
    rejectPlanQuality("week_schedule_too_sparse", {
      variant: plan.variant,
      plan,
      diagnostics,
      extraDetails: {
        minimumActiveDays,
        activeDays: Number(plan?.comparisonMetrics?.activeDays || 0),
        weekScheduleLength: weekSchedule.length,
      },
    });
  }

  if (!hasGroundedPlanText(plan.weekGoal, { intentTokens, planTokens })) {
    rejectPlanQuality("week_goal_not_grounded", { variant: plan.variant, plan, diagnostics });
  }

  if (!hasGroundedPlanText(plan.weekBenefit, { intentTokens, planTokens }) || trimString(plan.weekBenefit, 200).split(/\s+/).length < 5) {
    rejectPlanQuality("generic_week_benefit", { variant: plan.variant, plan, diagnostics });
  }

  if (!hasSpecificDifferenceNote(plan.differenceNote)) {
    rejectPlanQuality("generic_difference_note", { variant: plan.variant, plan, diagnostics });
  }

  if (plan.variant === "tenable" && diagnostics.lightDays < 1) {
    rejectPlanQuality("tenable_needs_light_day", { variant: plan.variant, plan, diagnostics });
  }

  if (plan.rhythmGuidance?.confidence === "low") {
    rejectPlanQuality("low_confidence_rhythm_guidance", { variant: plan.variant, plan, diagnostics });
  }
}

function buildDerivedView({ variant, summary, weekGoal, weekBenefit, differenceNote, rationale, commitDraft, context }) {
  const categories = [...commitDraft.categories].sort(sortByOrderThenId);
  const actions = [...commitDraft.actions].sort(sortByOrderThenId);
  const goals = [...commitDraft.goals].sort(sortByOrderThenId);
  const occurrences = [...commitDraft.occurrences].sort(sortOccurrences);

  const categoriesById = new Map(categories.map((entry) => [entry.id, entry]));
  const actionsById = new Map(actions.map((entry) => [entry.id, entry]));
  const goalsById = new Map(goals.map((entry) => [entry.id, entry]));
  const horizonKeySet = new Set(buildDateHorizon(context.referenceDateKey));

  const rows = occurrences
    .filter((occurrence) => horizonKeySet.has(occurrence.date))
    .map((occurrence) => {
      const action = actionsById.get(occurrence.actionId);
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
  const scheduleHorizonKeys = buildDateHorizon(context.referenceDateKey);
  const weekSchedule = buildWeekSchedule({ rows, context, horizonKeys: scheduleHorizonKeys });
  const rhythmGuidance = buildRhythmGuidance({ rows, preferredWindows: context.preferredWindows });

  return {
    id: variant,
    variant,
    title: getFirstRunPlanTitle(variant),
    summary,
    weekGoal,
    weekBenefit,
    differenceNote,
    comparisonMetrics,
    categories: categorySummary,
    preview,
    todayPreview,
    weekSchedule,
    rhythmGuidance,
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

function validateCommitDraft({ variant, commitDraft, context, repairDiagnostics = null }) {
  const categories = [...commitDraft.categories].sort(sortByOrderThenId);
  const goals = [...commitDraft.goals].sort(sortByOrderThenId);
  const actions = [...commitDraft.actions].sort(sortByOrderThenId);
  const occurrences = [...commitDraft.occurrences].sort(sortOccurrences);

  const categoryIds = new Set();
  const goalIds = new Set();
  const actionIds = new Set();
  const occurrenceIds = new Set();
  const allowedTemplateIds = new Set(ALL_FIRST_RUN_CATEGORY_IDS);
  const horizonKeys = new Set(buildDateHorizon(context.referenceDateKey));
  const actionsById = new Map();
  const buildValidationDetails = (overrides = {}) =>
    appendRepairDiagnostics(
      buildInvalidResponseDetails({
        rejectionStage: "commit_draft_validation",
        ...overrides,
      }),
      repairDiagnostics
    );

  if (categories.length > MAX_COMMIT_DRAFT_CATEGORIES) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildValidationDetails({
        rejectionReason: "too_many_categories",
      })
    );
  }

  categories.forEach((category) => {
    if (categoryIds.has(category.id)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "duplicate_category_id",
        })
      );
    }
    categoryIds.add(category.id);
    if (!allowedTemplateIds.has(category.templateId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
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
        buildValidationDetails({
          rejectionReason: "duplicate_goal_id",
        })
      );
    }
    goalIds.add(goal.id);
    if (!categoryIds.has(goal.categoryId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
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
        buildValidationDetails({
          rejectionReason: "duplicate_action_id",
        })
      );
    }
    actionIds.add(action.id);
    actionsById.set(action.id, action);
    if (!categoryIds.has(action.categoryId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "action_category_missing",
        })
      );
    }
    if (action.parentGoalId && !goalIds.has(action.parentGoalId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "action_parent_goal_missing",
        })
      );
    }
    if (action.timeMode === "FIXED" && action.startTime !== action.timeSlots[0]) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
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
        buildValidationDetails({
          rejectionReason: "duplicate_occurrence_id",
        })
      );
    }
    occurrenceIds.add(occurrence.id);
    if (!actionIds.has(occurrence.actionId)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "occurrence_action_missing",
          variant,
          availableActionIds: [...actionIds].slice(0, 12),
          invalidOccurrenceRefs: [
            {
              occurrenceId: occurrence.id,
              actionId: trimString(occurrence.actionId, 120) || null,
            },
          ],
          rejectedOccurrenceCount: 1,
        })
      );
    }
    if (!horizonKeys.has(occurrence.date)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "occurrence_out_of_horizon",
        })
      );
    }
    const action = actionsById.get(occurrence.actionId);
    const occurrenceDay = appDowFromDate(fromLocalDateKey(occurrence.date));
    if (!action?.daysOfWeek?.includes(occurrenceDay)) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "occurrence_day_mismatch",
        })
      );
    }
    if (action.timeMode === "FIXED" && occurrence.start !== action.startTime) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
          rejectionReason: "occurrence_time_mismatch",
        })
      );
    }
    if (context.unavailableWindows.some((windowValue) => doesOccurrenceOverlapWindow(occurrence, windowValue))) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        buildValidationDetails({
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
        buildValidationDetails({
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
    weekGoal: "objectif de semaine",
    weekBenefit: "benefice concret a j+7",
    differenceNote: "difference structurelle de semaine",
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
      buildValidationDetails({
        rejectionReason: "weekly_minutes_out_of_band",
        details: {
          variant,
          weeklyMinutes,
          expected: bands,
          maxRepairDelta: MAX_WEEKLY_MINUTE_REPAIR_DELTA,
        },
      })
    );
  }
}

function validatePlanDivergence(plans = [], context) {
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

  validatePlanQuality({ plan: tenable, context });
  validatePlanQuality({ plan: ambitious, context });

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

  const tenableDiagnostics = buildPlanDiagnostics(tenable);
  const ambitiousDiagnostics = buildPlanDiagnostics(ambitious);
  const hasStructuralDifference =
    ambitious.comparisonMetrics.activeDays > tenable.comparisonMetrics.activeDays ||
    ambitious.comparisonMetrics.totalBlocks > tenable.comparisonMetrics.totalBlocks ||
    ambitiousDiagnostics.denseDays > tenableDiagnostics.denseDays ||
    ambitiousDiagnostics.lightDays < tenableDiagnostics.lightDays ||
    ambitious.weekSchedule.some((entry, index) => {
      const tenableEntry = tenable.weekSchedule[index] || null;
      if (!tenableEntry) return true;
      return (
        entry.blockCount !== tenableEntry.blockCount ||
        entry.loadLabel !== tenableEntry.loadLabel ||
        (entry.blockCount > 0 && entry.primarySlotLabel !== tenableEntry.primarySlotLabel)
      );
    });

  if (!hasStructuralDifference || normalizeTextKey(tenable.differenceNote, 200) === normalizeTextKey(ambitious.differenceNote, 200)) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: "variant_divergence",
        rejectionReason: "plans_too_similar_structurally",
        tenableDiagnostics,
        ambitiousDiagnostics,
      })
    );
  }
}

function buildFirstRunPlanServiceDiagnostics({ providerMs = null, totalMs = null, repairTotals = null, plans = [] } = {}) {
  return {
    providerMs: toRoundedInt(providerMs, null),
    totalMs: toRoundedInt(totalMs, null),
    repairedOccurrenceCount: toRoundedInt(repairTotals?.repairedOccurrenceCount, 0),
    repairedMinutesDelta: toRoundedInt(repairTotals?.repairedMinutesDelta, 0),
    activeDays: plans.map((plan) => toRoundedInt(plan?.comparisonMetrics?.activeDays, 0)),
    lightDays: plans.map((plan) => buildPlanDiagnostics(plan).lightDays),
    denseDays: plans.map((plan) => buildPlanDiagnostics(plan).denseDays),
  };
}

function normalizeProviderPayload(providerPayload, context, requestMeta) {
  const repairItems = [];
  let plans = [];

  try {
    plans = providerPayload.plans
      .map((entry) => {
        const referenceRepair = normalizeCommitDraftReferences({
          variant: entry.variant,
          commitDraft: entry.commitDraft,
        });
        let preparedCommitDraft = repairCommitDraftTimeCoherence({
          commitDraft: referenceRepair.commitDraft,
          context,
          repairDiagnostics: referenceRepair.repairDiagnostics,
        });
        preparedCommitDraft = repairWeeklyMinuteBand({
          variant: entry.variant,
          commitDraft: preparedCommitDraft,
          context,
          repairDiagnostics: referenceRepair.repairDiagnostics,
        }).commitDraft;
        repairItems.push(referenceRepair.repairDiagnostics);
        validateCommitDraft({
          variant: entry.variant,
          commitDraft: preparedCommitDraft,
          context,
          repairDiagnostics: referenceRepair.repairDiagnostics,
        });
        return buildDerivedView({
          variant: entry.variant,
          summary: entry.summary,
          weekGoal: entry.weekGoal,
          weekBenefit: entry.weekBenefit,
          differenceNote: entry.differenceNote,
          rationale: entry.rationale,
          commitDraft: preparedCommitDraft,
          context,
        });
      })
      .sort((left, right) => FIRST_RUN_PLAN_VARIANTS.indexOf(left.variant) - FIRST_RUN_PLAN_VARIANTS.indexOf(right.variant));

    validatePlanDivergence(plans, context);
  } catch (error) {
    if (String(error?.code || "").trim().toUpperCase() === "INVALID_FIRST_RUN_PLAN_RESPONSE") {
      const repairTotals = sumRepairDiagnostics(repairItems);
      error.details = appendRepairDiagnostics(
        isPlainObject(error?.details) ? error.details : buildInvalidResponseDetails(),
        repairTotals
      );
    }
    throw error;
  }

  const repairTotals = sumRepairDiagnostics(repairItems);
  return {
    response: firstRunPlanResponseSchema.parse({
      version: 2,
      source: "ai_backend",
      inputHash: requestMeta.inputHash,
      generatedAt: new Date().toISOString(),
      requestId: context.requestId,
      model: requestMeta.model,
      promptVersion: requestMeta.promptVersion,
      plans,
    }),
    diagnostics: buildFirstRunPlanServiceDiagnostics({
      providerMs: requestMeta.providerMs,
      totalMs: requestMeta.totalMs,
      repairTotals,
      plans,
    }),
  };
}

async function runOpenAiFirstRunPlan({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("FIRST_RUN_PLAN_BACKEND_UNAVAILABLE");
  }
  const requestModel = resolveFirstRunPlanOpenAiModel(app);
  const requestTimeout = resolveFirstRunPlanOpenAiTimeoutMs(app);
  let completion;
  const providerStartedAt = Date.now();
  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.35,
        response_format: zodResponseFormat(firstRunPlanOpenAiSchema, "first_run_plan_payload"),
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
    const providerMs = Math.max(0, Date.now() - providerStartedAt);
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError(
        "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
        "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
        {
          ...buildProviderTimeoutDetails({ timeoutMs: requestTimeout }),
          providerMs,
          totalMs: providerMs,
        }
      );
    }
    throw error;
  }
  const providerMs = Math.max(0, Date.now() - providerStartedAt);

  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      {
        ...buildInvalidResponseDetails(),
        providerMs,
        totalMs: providerMs,
      }
    );
  }
  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError(
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      "INVALID_FIRST_RUN_PLAN_RESPONSE",
      {
        ...buildInvalidResponseDetails(),
        providerMs,
        totalMs: providerMs,
      }
    );
  }

  try {
    return {
      candidate: firstRunPlanProviderSchema.parse(candidate),
      model: requestModel,
      promptVersion: FIRST_RUN_PLAN_PROMPT_VERSION,
      providerMs,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createBackendError(
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        "INVALID_FIRST_RUN_PLAN_RESPONSE",
        {
          ...buildInvalidResponseDetails({
          zodIssuePaths: error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 16),
          }),
          providerMs,
          totalMs: providerMs,
        }
      );
    }
    throw error;
  }
}

export async function runFirstRunPlanService({ app, context }) {
  const startedAt = Date.now();
  const inputHash = hashValue(serializeFirstRunPlanInput(context));
  let provider = null;

  try {
    provider = await runOpenAiFirstRunPlan({ app, context });
    const totalMs = Math.max(0, Date.now() - startedAt);
    return normalizeProviderPayload(provider.candidate, context, {
      inputHash,
      model: provider.model,
      promptVersion: provider.promptVersion,
      providerMs: provider.providerMs,
      totalMs,
    });
  } catch (error) {
    const totalMs = Math.max(0, Date.now() - startedAt);
    const safeDetails = isPlainObject(error?.details) ? error.details : null;
    error.details = {
      ...(safeDetails || {}),
      providerMs: toRoundedInt(safeDetails?.providerMs ?? provider?.providerMs, null),
      totalMs,
    };
    throw error;
  }
}

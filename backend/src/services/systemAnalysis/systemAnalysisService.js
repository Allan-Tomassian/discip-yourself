import { APIConnectionTimeoutError } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  systemAnalysisProviderResponseSchema,
  systemAnalysisPublicResponseSchema,
} from "../../schemas/systemAnalysis.js";
import { resolveAiModelConfig } from "../aiModelRouting.js";
import { AI_FEATURE_IDS } from "../../../../src/domain/aiPolicy.js";

const DEFAULT_SYSTEM_ANALYSIS_MODEL = "gpt-5.4";
const DEFAULT_SYSTEM_ANALYSIS_TIMEOUT_MS = 65000;
const MAX_SYSTEM_ANALYSIS_TIMEOUT_MS = 90000;
const DEFAULT_SYSTEM_ANALYSIS_PROMPT_VERSION = "system_analysis_v2_0";

const MEDICAL_CLAIM_RE =
  /\b(diagnostique|diagnose|diagnosis|medical|m[eé]dical|clinique|d[eé]pression|depression|tdah|adhd|bipolaire|bipolar)\b/i;
const GUILT_LANGUAGE_RE =
  /\b(tu as [eé]chou[eé]|tu es paresseux|paresseuse|faible|manque de volont[eé]|aucune discipline|c'est ta faute)\b/i;
const DIRECT_PERSISTED_OBJECT_KEYS = new Set([
  "occurrence",
  "occurrences",
  "goal",
  "goals",
  "actionObject",
  "actionPayload",
  "persistedOccurrence",
  "persistedGoal",
]);
const DIRECT_OCCURRENCE_FIELD_KEYS = new Set([
  "status",
  "goalId",
  "scheduleRuleId",
  "doneAt",
  "repairV1",
  "startAt",
  "endAt",
]);
const SYSTEM_ANALYSIS_V2_MODES = new Set(["initial_analysis", "hybrid_analysis", "behavioral_analysis"]);
const V2_TARGET_TYPES = Object.freeze({
  OCCURRENCE: "occurrence",
  OBJECTIVE: "objective",
  ACTION: "action",
  SCHEDULE: "schedule",
  SYSTEM: "system",
});
const V2_APPLICABLE_ACTIONS = new Set(["move", "reduce"]);
const V2_ADD_ACTIONS = new Set(["add"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, maxLength = null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!Number.isFinite(maxLength)) return trimmed;
  return trimmed.slice(0, Math.max(0, maxLength));
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

function buildProviderTimeoutDetails({ timeoutMs = null, providerMs = null } = {}) {
  return {
    providerStatus: "timeout",
    rejectionStage: "provider_timeout",
    rejectionReason: "provider_timeout",
    validationPassed: false,
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(0, Math.round(timeoutMs)) : null,
    providerMs: Number.isFinite(providerMs) ? Math.max(0, Math.round(providerMs)) : null,
  };
}

function buildInvalidResponseDetails(overrides = {}) {
  return {
    providerStatus: "invalid_response",
    rejectionStage: "provider_parse",
    rejectionReason: "provider_parse_failed",
    validationPassed: false,
    zodIssuePaths: [],
    governanceIssues: [],
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

export function resolveSystemAnalysisModelConfig(app) {
  return resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    config: app?.config,
    routeOverride: {
      model: app?.config?.SYSTEM_ANALYSIS_MODEL,
      timeoutMs: app?.config?.SYSTEM_ANALYSIS_TIMEOUT_MS,
      promptVersion: resolveSystemAnalysisPromptVersion(app),
      defaultModel: DEFAULT_SYSTEM_ANALYSIS_MODEL,
      defaultTimeoutMs: DEFAULT_SYSTEM_ANALYSIS_TIMEOUT_MS,
      minTimeoutMs: 1000,
      maxTimeoutMs: MAX_SYSTEM_ANALYSIS_TIMEOUT_MS,
      allowGlobalFallback: false,
    },
  });
}

export function resolveSystemAnalysisModel(app) {
  return resolveSystemAnalysisModelConfig(app).model;
}

export function resolveSystemAnalysisTimeoutMs(app) {
  return resolveSystemAnalysisModelConfig(app).timeoutMs;
}

export function resolveSystemAnalysisPromptVersion(app) {
  return String(app?.config?.SYSTEM_ANALYSIS_PROMPT_VERSION || "").trim() || DEFAULT_SYSTEM_ANALYSIS_PROMPT_VERSION;
}

export function buildSystemAnalysisSystemPrompt({ locale = "fr-FR" } = {}) {
  return [
    "You are the premium read-only system auditor for Discip Yourself.",
    `Write all user-visible output in natural French (${locale}).`,
    "Analyze the user's discipline system from the compact snapshot only.",
    "Compare the planned system against the user's actual behavior.",
    "Do not mutate data, do not say changes were applied, and do not output persisted source-of-truth objects.",
    "Do not diagnose medical or clinical conditions.",
    "Do not use guilt, shame, blame, or punishment language.",
    "Do not invent objectives, actions, occurrences, sessions, or facts not present in the snapshot.",
    "Every major finding must include evidence grounded in snapshot facts.",
    "Keep the result compact and decision-oriented for a mobile command sheet.",
    "Do not output a long report, dashboard, analytics table, or generic motivational advice.",
    "Prefer one to three high-impact corrections over many weak suggestions.",
    "The correctionDraft must be a proposal only, compatible with deterministic validation and user confirmation.",
  ].join("\n");
}

export function buildSystemAnalysisUserPrompt({ context }) {
  const snapshot = context.snapshot;
  const promptSnapshot = {
    period: snapshot.period,
    referenceDateKey: snapshot.referenceDateKey,
    userWhy: snapshot.userWhy,
    firstRunSummary: snapshot.firstRunSummary,
    goalsSummary: snapshot.goalsSummary,
    actionsSummary: snapshot.actionsSummary,
    executionStats: snapshot.executionStats,
    sessionStats: snapshot.sessionStats,
    timePatterns: snapshot.timePatterns,
    frictionPatterns: snapshot.frictionPatterns,
    objectiveSignals: snapshot.objectiveSignals,
    planningLoadSignals: snapshot.planningLoadSignals,
    systemSignals: snapshot.systemSignals,
    adjustDiagnosticSummary: snapshot.adjustDiagnosticSummary,
    coachThemes: snapshot.coachThemes,
    profilePreferences: snapshot.profilePreferences,
    dataLimitations: snapshot.dataLimitations,
    sourceCounts: snapshot.sourceCounts,
    snapshotHash: snapshot.snapshotHash,
    plannedSystem: snapshot.plannedSystem || null,
    behaviorSystem: snapshot.behaviorSystem || null,
    comparisonSignals: snapshot.comparisonSignals || null,
    confidenceBySignal: snapshot.confidenceBySignal || null,
    analysisModeRecommendation: snapshot.analysisModeRecommendation || null,
  };
  return [
    "Produce one SystemAnalysisResult JSON object.",
    "Hard requirements:",
    "1. version must be 2 and period must exactly match snapshot.period.",
    "2. analysisMode must be initial_analysis, hybrid_analysis, or behavioral_analysis. Prefer snapshot.analysisModeRecommendation unless the evidence strongly supports a safer mode.",
    "3. Include diagnosisSummary, executiveSummary, invisibleFriction, systemWeaknesses, strongestPatterns, recommendedCorrections, correctionDraft, next7DaysFocus, coachQuestions, confidence, dataLimitations, safetyNotes, generatedAt, and modelMeta.",
    "4. diagnosisSummary must state the top primaryFinding, risk, opportunity, evidence, and confidence.",
    "5. correctionDraft.version must be 2, correctionDraft.userConfirmationRequired must be true, and correctionDraft.correctionItems must contain compact correction cards.",
    "6. Each major finding and each correctionItem must cite evidence from the snapshot. Use occurrenceId, historyId, actionId, goalId, objectiveId, dateKey, counts, or short fact strings when available.",
    "7. Each correctionItem must answer whatChanges, why, expectedImpact, risk, evidence, confidence, supportStatus, destructive, and confirmationLevel.",
    "8. Applicable v2 corrections are limited to non-destructive occurrence move or reduce items. Objective, action, schedule, system, protect, add, remove, replace, pause, clarify, merge, split, rebalance, and link proposals must be needs_review or unsupported for now.",
    "9. Remove/delete proposals must use destructive true, confirmationLevel destructive, and supportStatus needs_review or unsupported. Never make destructive proposals applicable.",
    "10. Do not include occurrence, occurrences, goal, goals, actionObject, actionPayload, persistedOccurrence, persistedGoal, or persisted occurrence fields such as status, goalId, scheduleRuleId, doneAt, repairV1, startAt, endAt.",
    "11. Mention data limitations honestly. If execution data is thin, do not pretend behavior patterns exist.",
    "12. Never claim a correction was applied.",
    "13. Do not contradict first-run constraints: availability, unavailable windows, preferred windows, declared capacity, primary objective, or schedule rules.",
    "14. Prefer no more than three priority correctionItems. If more are necessary, make lower-priority items clearly less urgent.",
    "Mode instructions:",
    "- initial_analysis: structural audit only. Focus on empty planning, unused availability, objectives without blocks, missing next block, planned load vs capacity, and why coherence. Do not infer behavioral patterns.",
    "- hybrid_analysis: combine structure with early behavior. Name uncertainty clearly.",
    "- behavioral_analysis: compare actual completion and friction against the plan. Identify best windows, objective neglect, action avoidance, load mismatch, and system drift.",
    "Output quality:",
    "- Keep the answer compact enough for the existing mobile command sheet.",
    "- Prioritize the top diagnosis.",
    "- Do not output a long essay.",
    "- Do not output raw analytics tables.",
    "- Do not output generic motivational advice.",
    `Request meta: ${JSON.stringify({
      locale: context.locale,
      timezone: context.timezone,
      referenceDateKey: context.referenceDateKey,
      requestId: context.requestId,
      promptVersion: context.promptVersion,
      snapshotHash: snapshot.snapshotHash,
    })}`,
    `Snapshot: ${JSON.stringify(promptSnapshot)}`,
  ].join("\n");
}

function periodMatches(left, right) {
  return (
    safeString(left?.startDateKey) === safeString(right?.startDateKey) &&
    safeString(left?.endDateKey) === safeString(right?.endDateKey) &&
    Number(left?.days) === Number(right?.days)
  );
}

function scanText(value, visitor, path = "") {
  if (typeof value === "string") {
    visitor(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanText(entry, visitor, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => scanText(entry, visitor, path ? `${path}.${key}` : key));
  }
}

function scanObjects(value, visitor, path = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanObjects(entry, visitor, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  visitor(value, path);
  Object.entries(value).forEach(([key, entry]) => scanObjects(entry, visitor, path ? `${path}.${key}` : key));
}

function pushIssue(issues, issue) {
  issues.push({
    code: safeString(issue?.code),
    severity: safeString(issue?.severity) || "error",
    path: safeString(issue?.path),
    message: safeString(issue?.message),
    entityType: safeString(issue?.entityType) || null,
    entityId: safeString(issue?.entityId) || null,
  });
}

function buildStateReferenceSets(state) {
  const goals = safeArray(state?.goals);
  const occurrences = safeArray(state?.occurrences);
  const goalIds = new Set(goals.map((goal) => safeString(goal?.id)).filter(Boolean));
  const actionIds = new Set();
  const objectiveIds = new Set();
  for (const goal of goals) {
    const id = safeString(goal?.id);
    if (!id) continue;
    const type = safeString(goal?.type || goal?.goalType || goal?.kind).toUpperCase();
    if (type === "PROCESS" || type === "ACTION" || safeString(goal?.parentId)) actionIds.add(id);
    if (type === "OUTCOME" || type === "OBJECTIVE" || !safeString(goal?.parentId)) objectiveIds.add(id);
  }
  return {
    goalIds,
    actionIds,
    objectiveIds,
    occurrenceIds: new Set(occurrences.map((occurrence) => safeString(occurrence?.id)).filter(Boolean)),
  };
}

function parseTimeToMinutes(value) {
  const raw = safeString(value);
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getIsoDow(dateKey) {
  const normalized = safeString(dateKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function proposedTimeHitsUnavailableWindow({ snapshot, dateKey, start }) {
  const dow = getIsoDow(dateKey);
  const startMinutes = parseTimeToMinutes(start);
  if (!dow || !Number.isFinite(startMinutes)) return false;
  return safeArray(snapshot?.plannedSystem?.unavailableWindows).some((windowValue) => {
    const days = safeArray(windowValue?.daysOfWeek).map((day) => Number(day)).filter(Number.isInteger);
    if (days.length && !days.includes(dow)) return false;
    const windowStart = parseTimeToMinutes(windowValue?.startTime);
    const windowEnd = parseTimeToMinutes(windowValue?.endTime);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return false;
    return startMinutes >= windowStart && startMinutes < windowEnd;
  });
}

function getSnapshotCapacityMinutes(snapshot) {
  const capacity = Number(snapshot?.plannedSystem?.capacity?.dailyMinutes);
  return Number.isFinite(capacity) ? capacity : null;
}

function getCorrectionItemProposedLoad(item) {
  const proposedLoad = isPlainObject(item?.proposedLoad) ? item.proposedLoad : {};
  const candidates = [
    item?.proposedMaxDailyMinutes,
    item?.proposedDailyMinutes,
    proposedLoad.maxDailyMinutes,
    proposedLoad.dailyMinutes,
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function referenceSetForTargetType(refs, targetType) {
  if (targetType === V2_TARGET_TYPES.OCCURRENCE) return refs.occurrenceIds;
  if (targetType === V2_TARGET_TYPES.ACTION) return refs.actionIds.size ? refs.actionIds : refs.goalIds;
  if (targetType === V2_TARGET_TYPES.OBJECTIVE) return refs.objectiveIds.size ? refs.objectiveIds : refs.goalIds;
  return null;
}

function validateCorrectionItemGovernance({ item, path, refs, snapshot, issues }) {
  const targetType = safeString(item?.targetType);
  const action = safeString(item?.action);
  const targetId = safeString(item?.targetId);
  const supportStatus = safeString(item?.supportStatus);
  const destructive = item?.destructive === true;
  const confirmationLevel = safeString(item?.confirmationLevel);

  if (!V2_ADD_ACTIONS.has(action) && targetId) {
    const referenceSet = referenceSetForTargetType(refs, targetType);
    if (referenceSet && referenceSet.size && !referenceSet.has(targetId)) {
      pushIssue(issues, {
        code:
          targetType === V2_TARGET_TYPES.OCCURRENCE ? "UNKNOWN_OCCURRENCE_REFERENCE"
          : targetType === V2_TARGET_TYPES.ACTION ? "UNKNOWN_GOAL_REFERENCE"
          : targetType === V2_TARGET_TYPES.OBJECTIVE ? "UNKNOWN_GOAL_REFERENCE"
          : "UNKNOWN_CORRECTION_TARGET_REFERENCE",
        path: `${path}.targetId`,
        message: "System analysis correction item references a missing target.",
        entityType: targetType || "target",
        entityId: targetId,
      });
    }
  }

  if (action === "remove" && (!destructive || confirmationLevel !== "destructive")) {
    pushIssue(issues, {
      code: "DESTRUCTIVE_CONFIRMATION_REQUIRED",
      path,
      message: "Remove proposals must be destructive and require destructive confirmation.",
      entityType: targetType || null,
      entityId: targetId || null,
    });
  }

  if (destructive && supportStatus === "applicable") {
    pushIssue(issues, {
      code: "DESTRUCTIVE_CORRECTION_CANNOT_BE_APPLICABLE",
      path: `${path}.supportStatus`,
      message: "Destructive correction items cannot be directly applicable.",
      entityType: targetType || null,
      entityId: targetId || null,
    });
  }

  if (supportStatus === "applicable") {
    if (targetType !== V2_TARGET_TYPES.OCCURRENCE || !V2_APPLICABLE_ACTIONS.has(action)) {
      pushIssue(issues, {
        code: "UNSUPPORTED_APPLICABLE_CORRECTION_ITEM",
        path,
        message: "Only non-destructive occurrence move or reduce items can be applicable.",
        entityType: targetType || null,
        entityId: targetId || null,
      });
    }
    if (action === "move" && (!safeString(item?.proposedDateKey) || !safeString(item?.proposedStart))) {
      pushIssue(issues, {
        code: "APPLICABLE_MOVE_REQUIRES_TIME",
        path,
        message: "Applicable occurrence move items must include a proposed date and start.",
        entityType: targetType || null,
        entityId: targetId || null,
      });
    }
    if (action === "reduce" && !Number.isFinite(Number(item?.proposedDurationMinutes))) {
      pushIssue(issues, {
        code: "APPLICABLE_REDUCE_REQUIRES_DURATION",
        path,
        message: "Applicable occurrence reduce items must include a proposed duration.",
        entityType: targetType || null,
        entityId: targetId || null,
      });
    }
  }

  if (
    safeString(item?.proposedDateKey) &&
    safeString(item?.proposedStart) &&
    proposedTimeHitsUnavailableWindow({
      snapshot,
      dateKey: item.proposedDateKey,
      start: item.proposedStart,
    })
  ) {
    pushIssue(issues, {
      code: "CORRECTION_TIME_CONFLICTS_WITH_UNAVAILABLE_WINDOW",
      path: `${path}.proposedStart`,
      message: "Correction item proposed time contradicts an unavailable window.",
      entityType: targetType || null,
      entityId: targetId || null,
    });
  }

  const proposedLoad = getCorrectionItemProposedLoad(item);
  const capacityMinutes = getSnapshotCapacityMinutes(snapshot);
  if (Number.isFinite(proposedLoad) && Number.isFinite(capacityMinutes) && proposedLoad > capacityMinutes) {
    pushIssue(issues, {
      code: "CORRECTION_LOAD_EXCEEDS_CAPACITY",
      path: `${path}.proposedLoad`,
      message: "Correction item proposed load exceeds declared capacity.",
      entityType: targetType || null,
      entityId: targetId || null,
    });
  }
}

export function validateSystemAnalysisGovernance(result, { snapshot, state } = {}) {
  const issues = [];
  const refs = buildStateReferenceSets(state);

  if (!periodMatches(result?.period, snapshot?.period)) {
    pushIssue(issues, {
      code: "SYSTEM_ANALYSIS_PERIOD_MISMATCH",
      path: "period",
      message: "System analysis result period must match the snapshot period.",
    });
  }

  scanText(result, (text, path) => {
    if (MEDICAL_CLAIM_RE.test(text)) {
      pushIssue(issues, {
        code: "UNSUPPORTED_MEDICAL_CLAIM",
        path,
        message: "System analysis result contains unsupported medical or clinical language.",
      });
    }
    if (GUILT_LANGUAGE_RE.test(text)) {
      pushIssue(issues, {
        code: "GUILT_LANGUAGE_DETECTED",
        severity: "warning",
        path,
        message: "System analysis result contains guilt-oriented language.",
      });
    }
  });

  scanObjects(result, (object, path) => {
    for (const key of Object.keys(object)) {
      if (DIRECT_PERSISTED_OBJECT_KEYS.has(key)) {
        pushIssue(issues, {
          code: "DIRECT_PERSISTED_OBJECT_FROM_AI",
          path: path ? `${path}.${key}` : key,
          message: "AI output must not include direct persisted source-of-truth objects.",
        });
      }
      if (path.includes("occurrenceAdjustments") && DIRECT_OCCURRENCE_FIELD_KEYS.has(key)) {
        pushIssue(issues, {
          code: "DIRECT_OCCURRENCE_FIELD_FROM_AI",
          path: path ? `${path}.${key}` : key,
          message: "Occurrence adjustments must use correction fields, not persisted occurrence fields.",
        });
      }
    }

    if (path.includes("correctionItems") && isPlainObject(object) && safeString(object.id)) {
      validateCorrectionItemGovernance({ item: object, path, refs, snapshot, issues });
    }

    const occurrenceId = safeString(object.occurrenceId);
    if (occurrenceId && refs.occurrenceIds.size && !refs.occurrenceIds.has(occurrenceId)) {
      pushIssue(issues, {
        code: "UNKNOWN_OCCURRENCE_REFERENCE",
        path: path ? `${path}.occurrenceId` : "occurrenceId",
        message: "System analysis result references a missing occurrence.",
        entityType: "occurrence",
        entityId: occurrenceId,
      });
    }

    for (const key of ["goalId", "objectiveId", "actionId"]) {
      const id = safeString(object[key]);
      if (id && refs.goalIds.size && !refs.goalIds.has(id)) {
        pushIssue(issues, {
          code: "UNKNOWN_GOAL_REFERENCE",
          path: path ? `${path}.${key}` : key,
          message: "System analysis result references a missing goal or action.",
          entityType: "goal",
          entityId: id,
        });
      }
    }
  });

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

function throwInvalidResponse({
  error,
  providerMs,
  totalMs,
  governanceIssues = [],
  model = null,
  modelClass = null,
  promptVersion = null,
} = {}) {
  const zodIssuePaths =
    error instanceof z.ZodError
      ? error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 24)
      : [];
  throw createBackendError(
    "INVALID_SYSTEM_ANALYSIS_RESPONSE",
    "INVALID_SYSTEM_ANALYSIS_RESPONSE",
    {
      ...buildInvalidResponseDetails({
        zodIssuePaths,
        governanceIssues,
      }),
      providerMs: Number.isFinite(providerMs) ? Math.round(providerMs) : null,
      totalMs: Number.isFinite(totalMs) ? Math.round(totalMs) : null,
      model,
      modelClass,
      promptVersion,
    }
  );
}

async function runOpenAiSystemAnalysis({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("SYSTEM_ANALYSIS_BACKEND_UNAVAILABLE");
  }

  const modelConfig = resolveSystemAnalysisModelConfig(app);
  const requestModel = modelConfig.model;
  const requestTimeout = modelConfig.timeoutMs;
  const providerStartedAt = Date.now();
  let completion;

  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.25,
        response_format: zodResponseFormat(systemAnalysisProviderResponseSchema, "system_analysis_result"),
        messages: [
          {
            role: "system",
            content: buildSystemAnalysisSystemPrompt({ locale: context.locale }),
          },
          {
            role: "user",
            content: buildSystemAnalysisUserPrompt({ context }),
          },
        ],
      },
      { timeout: requestTimeout }
    );
  } catch (error) {
    const providerMs = Math.max(0, Date.now() - providerStartedAt);
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError(
        "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT",
        "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT",
        {
          ...buildProviderTimeoutDetails({ timeoutMs: requestTimeout, providerMs }),
          model: requestModel,
          modelClass: modelConfig.modelClass,
          promptVersion: context.promptVersion,
          totalMs: providerMs,
        }
      );
    }
    throw createBackendError(
      "SYSTEM_ANALYSIS_PROVIDER_FAILED",
      "SYSTEM_ANALYSIS_PROVIDER_FAILED",
      {
        providerStatus: "error",
        rejectionStage: "provider",
        rejectionReason: "provider_failed",
        model: requestModel,
        modelClass: modelConfig.modelClass,
        promptVersion: context.promptVersion,
        validationPassed: false,
        providerMs,
        totalMs: providerMs,
      }
    );
  }

  const providerMs = Math.max(0, Date.now() - providerStartedAt);
  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throwInvalidResponse({
      providerMs,
      totalMs: providerMs,
      governanceIssues: [],
      error: null,
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
    });
  }
  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throwInvalidResponse({
      providerMs,
      totalMs: providerMs,
      governanceIssues: [],
      error: null,
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
    });
  }

  try {
    return {
      candidate: systemAnalysisProviderResponseSchema.parse(candidate),
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
      providerMs,
    };
  } catch (error) {
    throwInvalidResponse({
      error,
      providerMs,
      totalMs: providerMs,
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
    });
  }
}

export async function runSystemAnalysisService({ app, context }) {
  const startedAt = Date.now();
  const promptVersion = resolveSystemAnalysisPromptVersion(app);
  const provider = await runOpenAiSystemAnalysis({
    app,
    context: {
      ...context,
      promptVersion,
    },
  });
  const totalMs = Math.max(0, Date.now() - startedAt);
  const response = {
    ...provider.candidate,
    generatedAt: provider.candidate.generatedAt || new Date().toISOString(),
    modelMeta: {
      ...provider.candidate.modelMeta,
      model: provider.model,
      promptVersion,
      requestId: context.requestId,
      snapshotHash: context.snapshot?.snapshotHash,
    },
  };
  const parsedResponse = systemAnalysisPublicResponseSchema.parse(response);
  const governance = validateSystemAnalysisGovernance(parsedResponse, {
    snapshot: context.snapshot,
    state: context.state,
  });
  if (!governance.ok) {
    throwInvalidResponse({
      providerMs: provider.providerMs,
      totalMs,
      governanceIssues: governance.issues,
      model: provider.model,
      modelClass: provider.modelClass,
      promptVersion,
    });
  }
  return {
    response: parsedResponse,
    diagnostics: {
      providerMs: provider.providerMs,
      totalMs,
      promptVersion,
      model: provider.model,
      modelClass: provider.modelClass,
      governanceIssues: governance.issues,
    },
  };
}

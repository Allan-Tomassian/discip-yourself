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
const DEFAULT_SYSTEM_ANALYSIS_PROMPT_VERSION = "system_analysis_v1_0";

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
    "Do not mutate data, do not say changes were applied, and do not output persisted source-of-truth objects.",
    "Do not diagnose medical or clinical conditions.",
    "Do not use guilt, shame, blame, or punishment language.",
    "Do not invent objectives, actions, occurrences, sessions, or facts not present in the snapshot.",
    "Every major finding must include evidence grounded in snapshot facts.",
    "Prefer fewer high-impact corrections over many weak suggestions.",
    "The correctionDraft must be a proposal only, compatible with deterministic validation and user confirmation.",
  ].join("\n");
}

export function buildSystemAnalysisUserPrompt({ context }) {
  const snapshot = context.snapshot;
  return [
    "Produce one SystemAnalysisResult JSON object.",
    "Hard requirements:",
    "1. version must be 1 and period must exactly match snapshot.period.",
    "2. Include executiveSummary, invisibleFriction, systemWeaknesses, strongestPatterns, recommendedCorrections, correctionDraft, next7DaysFocus, coachQuestions, confidence, dataLimitations, safetyNotes, generatedAt, and modelMeta.",
    "3. Each finding must cite evidence from the snapshot. Use occurrenceId, historyId, actionId, goalId, objectiveId, dateKey, counts, or short fact strings when available.",
    "4. correctionDraft.userConfirmationRequired must be true.",
    "5. occurrenceAdjustments may use only: move, reduce_duration, postpone, skip_once, protect.",
    "6. Do not include occurrence, occurrences, goal, goals, actionObject, actionPayload, persistedOccurrence, persistedGoal, or persisted occurrence fields such as status, goalId, scheduleRuleId, doneAt, repairV1, startAt, endAt.",
    "7. Mention data limitations honestly.",
    "8. Never claim a correction was applied.",
    `Request meta: ${JSON.stringify({
      locale: context.locale,
      timezone: context.timezone,
      referenceDateKey: context.referenceDateKey,
      requestId: context.requestId,
      promptVersion: context.promptVersion,
      snapshotHash: snapshot.snapshotHash,
    })}`,
    `Snapshot: ${JSON.stringify(snapshot)}`,
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
  return {
    goalIds,
    occurrenceIds: new Set(occurrences.map((occurrence) => safeString(occurrence?.id)).filter(Boolean)),
  };
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

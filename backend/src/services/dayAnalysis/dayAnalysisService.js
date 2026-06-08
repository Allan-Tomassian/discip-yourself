import { APIConnectionTimeoutError } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  dayAnalysisProviderResponseSchema,
  dayAnalysisPublicResponseSchema,
} from "../../schemas/dayAnalysis.js";
import { resolveAiModelConfig } from "../aiModelRouting.js";
import { AI_FEATURE_IDS, AI_MODEL_CLASSES } from "../../../../src/domain/aiPolicy.js";

const DEFAULT_DAY_ANALYSIS_PROMPT_VERSION = "day_analysis_v1_0";

const UNSAFE_TEXT_RULES = [
  {
    code: "UNSUPPORTED_MEDICAL_CLAIM",
    pattern: /\b(diagnostic médical|medical diagnosis|dépression|depression|anxiété|anxiety|traitement|médicament|clinique|pathologie)\b/i,
  },
  {
    code: "GUILT_LANGUAGE_DETECTED",
    pattern: /\b(faute|culpabil|honte|paresse|tu aurais dû|échec personnel|manque de volonté|aucune discipline)\b/i,
  },
  {
    code: "BROAD_SYSTEM_REWRITE_CLAIM",
    pattern: /\b(tout le système|réécrire|refondre|reconstruire.+système|changer tous|réorganiser toute)\b/i,
  },
  {
    code: "UNSUPPORTED_MUTATION_CLAIM",
    pattern: /(j['’]ai (modifié|déplacé|réduit|créé|supprimé)|a été (modifié|déplacé|créé|supprimé)|appliqué automatiquement)/i,
  },
  {
    code: "UNSUPPORTED_DELETE_ACTION",
    pattern: /\b(supprimer|effacer|delete|remove)\b.{0,40}\b(objectif|action|bloc|occurrence)\b/i,
  },
  {
    code: "MULTI_DAY_STRATEGIC_ANALYSIS",
    pattern: /\b(semaine complète|plusieurs semaines|30 jours|prochains 7 jours|plan global|analyse système|stratégie globale)\b/i,
  },
];

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

function formatIssuePath(issue = null) {
  const path = Array.isArray(issue?.path) ? issue.path : [];
  return path.map((entry) => String(entry)).filter(Boolean).join(".");
}

function collectText(value, parts = []) {
  if (typeof value === "string") {
    parts.push(value);
    return parts;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectText(entry, parts));
    return parts;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((entry) => collectText(entry, parts));
  }
  return parts;
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
  throw createBackendError("INVALID_DAY_ANALYSIS_RESPONSE", "INVALID_DAY_ANALYSIS_RESPONSE", {
    ...buildInvalidResponseDetails({
      zodIssuePaths,
      governanceIssues,
    }),
    providerMs: Number.isFinite(providerMs) ? Math.round(providerMs) : null,
    totalMs: Number.isFinite(totalMs) ? Math.round(totalMs) : null,
    model,
    modelClass,
    promptVersion,
  });
}

export function resolveDayAnalysisPromptVersion(app) {
  return String(app?.config?.DAY_ANALYSIS_PROMPT_VERSION || "").trim() || DEFAULT_DAY_ANALYSIS_PROMPT_VERSION;
}

export function resolveDayAnalysisModelConfig(app) {
  return resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.TODAY_AI_INSIGHT,
    config: app?.config,
    routeOverride: {
      modelClass: AI_MODEL_CLASSES.REASONING_MEDIUM,
      promptVersion: resolveDayAnalysisPromptVersion(app),
      defaultTimeoutMs: 35_000,
      minTimeoutMs: 20_000,
      maxTimeoutMs: 45_000,
      allowGlobalFallback: true,
    },
  });
}

export function buildDayAnalysisSystemPrompt({ locale = "fr-FR" } = {}) {
  return [
    "You are Analyse IA du jour for Discip Yourself.",
    `Write all user-visible output in natural French (${locale}).`,
    "Your scope is tactical analysis for today only.",
    "Return one compact diagnostic, one recommended action, and zero to two alternatives.",
    "You must choose actions only from the deterministicActions provided in the snapshot.",
    "Never invent occurrence, action, objective, or candidate IDs.",
    "Never claim a change was applied. The user must confirm before any mutation.",
    "Do not recommend deleting objectives, deleting actions, broad regeneration, or multi-day strategic corrections.",
    "Do not run or imitate Analyse Système. Do not behave like Coach chat.",
    "Roles: Coach is conversation/help; Ajuster is deterministic diagnosis; Recovery is concrete failure repair; Analyse Système is strategic/global.",
    "No guilt, shame, blame, punishment, medical diagnosis, or vague motivational advice.",
    "If no action is useful, select a no_change, open_planning, or open_coach candidate when available.",
    "Keep evidence grounded in today's snapshot facts.",
  ].join("\n");
}

export function buildDayAnalysisUserPrompt({ context }) {
  const snapshot = context.snapshot;
  const promptSnapshot = {
    version: snapshot.version,
    dayKey: snapshot.dayKey,
    timezone: snapshot.timezone,
    activeCategoryId: snapshot.activeCategoryId,
    primaryGoal: snapshot.primaryGoal,
    whyText: snapshot.whyText,
    firstRun: snapshot.firstRun,
    primaryAction: snapshot.primaryAction,
    occurrences: snapshot.occurrences,
    sessionHistory: snapshot.sessionHistory,
    activeSession: snapshot.activeSession,
    systemSignals: snapshot.systemSignals,
    deterministicActions: safeArray(snapshot.deterministicActions).map((action) => ({
      id: action.id,
      type: action.type,
      label: action.label,
      description: action.description,
      targetType: action.targetType,
      targetId: action.targetId,
      supportStatus: action.supportStatus,
      confirmationRequired: action.confirmationRequired,
      preview: action.preview,
    })),
    dataLimitations: snapshot.dataLimitations,
  };
  return [
    "Produce exactly one DayAnalysisResult JSON object.",
    "Hard requirements:",
    "1. version must be 1 and dayKey must exactly match snapshot.dayKey.",
    "2. recommendedAction.id must be one deterministicActions id from the snapshot.",
    "3. alternatives must use zero to two other deterministicActions ids from the snapshot.",
    "4. userConfirmationRequired must be true.",
    "5. diagnosis.title and diagnosis.explanation must be concrete and short.",
    "6. diagnosis.evidence must cite today's actual facts: status, occurrence title, primary action, or empty day.",
    "7. Do not output a long report, dashboard, table, strategic analysis, or chat response.",
    "8. Do not claim any mutation was applied.",
    "9. Do not propose unsupported actions outside deterministicActions.",
    "10. If the day is already completed or coherent, select no_change if present.",
    `Request meta: ${JSON.stringify({
      locale: context.locale,
      timezone: context.timezone,
      dayKey: snapshot.dayKey,
      requestId: context.requestId,
      promptVersion: context.promptVersion,
      snapshotHash: context.snapshotHash,
    })}`,
    `Snapshot: ${JSON.stringify(promptSnapshot)}`,
  ].join("\n");
}

function validateTextGovernance(result) {
  const text = collectText(result).join("\n");
  const issues = [];
  for (const rule of UNSAFE_TEXT_RULES) {
    if (rule.pattern.test(text)) {
      issues.push({
        code: rule.code,
        severity: "error",
        path: "",
        message: "Day analysis output contains unsupported wording.",
      });
    }
  }
  return issues;
}

function normalizeActionFromCandidate(candidate) {
  return {
    id: candidate.id,
    type: candidate.type,
    label: candidate.label,
    description: candidate.description,
    targetType: candidate.targetType,
    targetId: candidate.targetId,
    supportStatus: candidate.supportStatus,
    deterministicAction: candidate.deterministicAction || null,
    confirmationRequired: Boolean(candidate.confirmationRequired),
    preview: isPlainObject(candidate.preview) ? candidate.preview : {},
  };
}

function validateAndNormalizeProviderResult(providerResult, { snapshot, modelMeta, quota }) {
  const issues = [];
  if (providerResult.dayKey !== snapshot.dayKey) {
    issues.push({
      code: "DAY_KEY_MISMATCH",
      severity: "error",
      path: "dayKey",
      message: "Day analysis result dayKey must match the snapshot dayKey.",
    });
  }

  const candidatesById = new Map(
    safeArray(snapshot.deterministicActions).map((candidate) => [candidate.id, candidate])
  );
  const recommendedCandidate = candidatesById.get(providerResult.recommendedAction?.id);
  if (!recommendedCandidate) {
    issues.push({
      code: "UNKNOWN_RECOMMENDED_CANDIDATE",
      severity: "error",
      path: "recommendedAction.id",
      message: "Recommended action must reference a deterministic candidate.",
    });
  } else if (providerResult.recommendedAction.type !== recommendedCandidate.type) {
    issues.push({
      code: "RECOMMENDED_CANDIDATE_TYPE_MISMATCH",
      severity: "error",
      path: "recommendedAction.type",
      message: "Recommended action type must match the deterministic candidate.",
    });
  }

  const alternatives = [];
  const seenIds = new Set(recommendedCandidate?.id ? [recommendedCandidate.id] : []);
  for (const [index, alternative] of safeArray(providerResult.alternatives).slice(0, 2).entries()) {
    const candidate = candidatesById.get(alternative?.id);
    if (!candidate) {
      issues.push({
        code: "UNKNOWN_ALTERNATIVE_CANDIDATE",
        severity: "error",
        path: `alternatives.${index}.id`,
        message: "Alternative must reference a deterministic candidate.",
      });
      continue;
    }
    if (seenIds.has(candidate.id)) {
      issues.push({
        code: "DUPLICATE_DAY_ANALYSIS_ACTION",
        severity: "error",
        path: `alternatives.${index}.id`,
        message: "Alternatives must not duplicate the recommended action.",
      });
      continue;
    }
    if (alternative.type !== candidate.type) {
      issues.push({
        code: "ALTERNATIVE_CANDIDATE_TYPE_MISMATCH",
        severity: "error",
        path: `alternatives.${index}.type`,
        message: "Alternative action type must match the deterministic candidate.",
      });
    }
    seenIds.add(candidate.id);
    alternatives.push(normalizeActionFromCandidate(candidate));
  }

  issues.push(...validateTextGovernance(providerResult));
  if (providerResult.userConfirmationRequired !== true) {
    issues.push({
      code: "USER_CONFIRMATION_REQUIRED",
      severity: "error",
      path: "userConfirmationRequired",
      message: "Day analysis must require user confirmation.",
    });
  }
  if (issues.length) return { ok: false, issues, normalized: null };

  return {
    ok: true,
    issues: [],
    normalized: {
      version: 1,
      dayKey: snapshot.dayKey,
      diagnosis: {
        title: safeString(providerResult.diagnosis.title, 140),
        explanation: safeString(providerResult.diagnosis.explanation, 600),
        evidence: safeArray(providerResult.diagnosis.evidence).map((entry) => safeString(entry, 220)).filter(Boolean).slice(0, 4),
        confidence: providerResult.diagnosis.confidence,
      },
      recommendedAction: normalizeActionFromCandidate(recommendedCandidate),
      alternatives,
      dataLimitations: safeArray(providerResult.dataLimitations).map((entry) => safeString(entry, 160)).filter(Boolean).slice(0, 6),
      userConfirmationRequired: true,
      modelMeta,
      ...(quota ? { quota } : {}),
    },
  };
}

async function runOpenAiDayAnalysis({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("DAY_ANALYSIS_BACKEND_UNAVAILABLE");
  }

  const modelConfig = resolveDayAnalysisModelConfig(app);
  const requestModel = modelConfig.model;
  const requestTimeout = modelConfig.timeoutMs;
  const providerStartedAt = Date.now();
  let completion;

  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.2,
        response_format: zodResponseFormat(dayAnalysisProviderResponseSchema, "day_analysis_result"),
        messages: [
          {
            role: "system",
            content: buildDayAnalysisSystemPrompt({ locale: context.locale }),
          },
          {
            role: "user",
            content: buildDayAnalysisUserPrompt({ context }),
          },
        ],
      },
      { timeout: requestTimeout }
    );
  } catch (error) {
    const providerMs = Math.max(0, Date.now() - providerStartedAt);
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError("DAY_ANALYSIS_PROVIDER_TIMEOUT", "DAY_ANALYSIS_PROVIDER_TIMEOUT", {
        ...buildProviderTimeoutDetails({ timeoutMs: requestTimeout, providerMs }),
        model: requestModel,
        modelClass: modelConfig.modelClass,
        promptVersion: context.promptVersion,
        totalMs: providerMs,
      });
    }
    throw createBackendError("DAY_ANALYSIS_PROVIDER_FAILED", "DAY_ANALYSIS_PROVIDER_FAILED", {
      providerStatus: "error",
      rejectionStage: "provider",
      rejectionReason: "provider_failed",
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
      validationPassed: false,
      providerMs,
      totalMs: providerMs,
    });
  }

  const providerMs = Math.max(0, Date.now() - providerStartedAt);
  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throwInvalidResponse({
      providerMs,
      totalMs: providerMs,
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
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: context.promptVersion,
    });
  }

  try {
    return {
      candidate: dayAnalysisProviderResponseSchema.parse(candidate),
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

export async function runDayAnalysisService({ app, context }) {
  const startedAt = Date.now();
  const promptVersion = resolveDayAnalysisPromptVersion(app);
  const provider = await runOpenAiDayAnalysis({
    app,
    context: {
      ...context,
      promptVersion,
    },
  });
  const totalMs = Math.max(0, Date.now() - startedAt);
  const modelMeta = {
    model: provider.model,
    modelClass: provider.modelClass,
    promptVersion,
    requestId: context.requestId,
    decisionSource: "ai",
    snapshotHash: context.snapshotHash,
  };
  const validation = validateAndNormalizeProviderResult(provider.candidate, {
    snapshot: context.snapshot,
    modelMeta,
    quota: context.quota || null,
  });
  if (!validation.ok) {
    throwInvalidResponse({
      providerMs: provider.providerMs,
      totalMs,
      governanceIssues: validation.issues,
      model: provider.model,
      modelClass: provider.modelClass,
      promptVersion,
    });
  }

  const parsedResponse = dayAnalysisPublicResponseSchema.parse(validation.normalized);
  return {
    response: parsedResponse,
    diagnostics: {
      providerMs: provider.providerMs,
      totalMs,
      promptVersion,
      model: provider.model,
      modelClass: provider.modelClass,
      governanceIssues: validation.issues,
    },
  };
}

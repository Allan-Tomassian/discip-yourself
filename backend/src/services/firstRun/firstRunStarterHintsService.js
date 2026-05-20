import { APIConnectionTimeoutError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  firstRunStarterActionHintSchema,
  firstRunStarterHintsPlanStrategySchema,
  firstRunStarterHintsResponseSchema,
  firstRunStarterRiskRitualSchema,
} from "../../schemas/firstRun.js";
import { hashValue } from "../logging.js";
import { resolveAiModelConfig } from "../aiModelRouting.js";
import { USER_AI_CATEGORY_META } from "../../../../src/domain/userAiProfile.js";
import { serializeFirstRunStarterHintsInput } from "../../../../src/features/first-run/firstRunPlanContract.js";
import { AI_FEATURE_IDS } from "../../../../src/domain/aiPolicy.js";

const DEFAULT_FIRST_RUN_STARTER_HINTS_MODEL = "gpt-4.1-mini";
const DEFAULT_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS = 10000;
const MAX_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS = 12000;
const FIRST_RUN_STARTER_HINTS_PROMPT_VERSION = "first_run_starter_hints_v1";

const firstRunStarterHintsProviderSchema = z
  .object({
    planStrategy: firstRunStarterHintsPlanStrategySchema,
    actionHints: z.array(firstRunStarterActionHintSchema).min(1).max(6),
    riskRituals: z.array(firstRunStarterRiskRitualSchema).max(4),
    missingInformation: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  })
  .strict();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
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

function resolveStarterHintsModelConfig(app) {
  return resolveAiModelConfig({
    featureId: AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS,
    config: app?.config,
    routeOverride: {
      model: app?.config?.FIRST_RUN_STARTER_HINTS_OPENAI_MODEL,
      timeoutMs: app?.config?.FIRST_RUN_STARTER_HINTS_OPENAI_TIMEOUT_MS,
      promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
      defaultModel: DEFAULT_FIRST_RUN_STARTER_HINTS_MODEL,
      defaultTimeoutMs: DEFAULT_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS,
      minTimeoutMs: 1000,
      maxTimeoutMs: MAX_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS,
      allowGlobalFallback: true,
    },
  });
}

function buildCategoryCatalog() {
  return Object.values(USER_AI_CATEGORY_META).map((entry) => ({
    id: entry.id,
    label: entry.label,
  }));
}

function buildWindowSummary(windows = []) {
  return Array.isArray(windows)
    ? windows.map((windowValue) => ({
        label: trimString(windowValue?.label, 80),
        daysOfWeek: Array.isArray(windowValue?.daysOfWeek) ? windowValue.daysOfWeek : [],
        startTime: trimString(windowValue?.startTime, 5),
        endTime: trimString(windowValue?.endTime, 5),
      }))
    : [];
}

function buildStarterHintsSystemPrompt() {
  return [
    "You create compact first-run starter hints for Discip Yourself.",
    "Output valid JSON only.",
    "All user-visible text must be in natural French.",
    "Generate concrete action hints only. Do not generate dates, occurrence ids, schedules, or commitDraft.",
    "The deterministic scheduler will build the 7-day plan, occurrences, and commitDraft later.",
    "Avoid generic titles like Focus profond, Mouvement, Revue du soir, Avancée projet.",
    "Use the user's whyText, primaryGoal, categories, capacity, and constraints to make action titles specific.",
  ].join("\n");
}

function buildStarterHintsPrompt(context) {
  return [
    "Return one recommended starter strategy and 3 to 6 concrete action hints.",
    "Hard requirements:",
    "1. actionHints titles must be short, concrete, and executable.",
    "2. No dates, no schedule, no occurrence ids, no commitDraft.",
    "3. Use only category ids from categoryCatalog.",
    "4. Keep suggestedDurationMinutes realistic for currentCapacity.",
    "5. Use riskRituals for short support rituals such as cravings, confidence, or friction.",
    "6. If the user mentions an app/project, name the concrete project work. If the user mentions sport, create a real sport session. If the user mentions smoking/cigarettes, create a short anti-cigarette ritual.",
    `Context: ${JSON.stringify({
      whyText: context.whyText,
      primaryGoal: context.primaryGoal,
      currentCapacity: context.currentCapacity,
      priorityCategoryIds: context.priorityCategoryIds,
      categoryCatalog: buildCategoryCatalog(),
      unavailableWindows: buildWindowSummary(context.unavailableWindows),
      preferredWindows: buildWindowSummary(context.preferredWindows),
      constraints: Array.isArray(context.constraints) ? context.constraints : [],
      contextPacks: Array.isArray(context.contextPacks) ? context.contextPacks : [],
      referenceDateKey: context.referenceDateKey,
      timezone: context.timezone,
      locale: context.locale,
    })}`,
  ].join("\n");
}

function extractPayloadCandidate(message) {
  if (message?.parsed && typeof message.parsed === "object") return message.parsed;
  const raw = typeof message?.content === "string" ? message.content.trim() : "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatIssuePath(issue = null) {
  const path = Array.isArray(issue?.path) ? issue.path : [];
  return path
    .map((entry) => String(entry))
    .filter(Boolean)
    .join(".");
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

async function runOpenAiStarterHints({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("FIRST_RUN_STARTER_HINTS_BACKEND_UNAVAILABLE");
  }

  const modelConfig = resolveStarterHintsModelConfig(app);
  const requestModel = modelConfig.model;
  const requestTimeout = modelConfig.timeoutMs;
  const providerStartedAt = Date.now();
  let completion;
  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.25,
        response_format: zodResponseFormat(firstRunStarterHintsProviderSchema, "first_run_starter_hints_payload"),
        messages: [
          {
            role: "system",
            content: buildStarterHintsSystemPrompt(),
          },
          {
            role: "user",
            content: buildStarterHintsPrompt(context),
          },
        ],
      },
      { timeout: requestTimeout }
    );
  } catch (error) {
    const providerMs = Math.max(0, Date.now() - providerStartedAt);
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError("FIRST_RUN_STARTER_HINTS_PROVIDER_TIMEOUT", "FIRST_RUN_STARTER_HINTS_PROVIDER_TIMEOUT", {
        providerStatus: "timeout",
        rejectionStage: "provider_timeout",
        rejectionReason: "provider_timeout",
        model: requestModel,
        modelClass: modelConfig.modelClass,
        promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
        validationPassed: false,
        richnessPassed: false,
        timeoutMs: requestTimeout,
        providerMs,
        totalMs: providerMs,
      });
    }
    throw error;
  }

  const providerMs = Math.max(0, Date.now() - providerStartedAt);
  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throw createBackendError("INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", {
      ...buildInvalidResponseDetails(),
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
      providerMs,
      totalMs: providerMs,
    });
  }

  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError("INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", {
      ...buildInvalidResponseDetails(),
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
      providerMs,
      totalMs: providerMs,
    });
  }

  try {
    return {
      candidate: firstRunStarterHintsProviderSchema.parse(candidate),
      model: requestModel,
      modelClass: modelConfig.modelClass,
      promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
      providerMs,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createBackendError("INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", "INVALID_FIRST_RUN_STARTER_HINTS_RESPONSE", {
        ...buildInvalidResponseDetails({
          zodIssuePaths: error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 16),
        }),
        model: requestModel,
        modelClass: modelConfig.modelClass,
        promptVersion: FIRST_RUN_STARTER_HINTS_PROMPT_VERSION,
        providerMs,
        totalMs: providerMs,
      });
    }
    throw error;
  }
}

export async function runFirstRunStarterHintsService({ app, context }) {
  const startedAt = Date.now();
  const inputHash = hashValue(serializeFirstRunStarterHintsInput(context));
  let provider = null;

  try {
    provider = await runOpenAiStarterHints({ app, context });
    const response = {
      version: 1,
      source: "ai_starter_hints",
      inputHash,
      generatedAt: new Date().toISOString(),
      planStrategy: provider.candidate.planStrategy,
      actionHints: provider.candidate.actionHints,
      riskRituals: provider.candidate.riskRituals,
      ai: {
        status: "succeeded",
        missingInformation: provider.candidate.missingInformation || [],
      },
    };
    return {
      response: firstRunStarterHintsResponseSchema.parse(response),
      diagnostics: {
        model: provider.model,
        modelClass: provider.modelClass,
        promptVersion: provider.promptVersion,
        providerMs: provider.providerMs,
        totalMs: Math.max(0, Date.now() - startedAt),
      },
    };
  } catch (error) {
    const safeDetails = isPlainObject(error?.details) ? error.details : null;
    error.details = {
      ...(safeDetails || {}),
      providerMs: Number.isFinite(safeDetails?.providerMs ?? provider?.providerMs)
        ? Math.round(safeDetails?.providerMs ?? provider?.providerMs)
        : null,
      totalMs: Math.max(0, Date.now() - startedAt),
    };
    throw error;
  }
}

import { APIConnectionTimeoutError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  firstRunWhyClarificationAxisSchema,
  firstRunWhyClarificationContentSchema,
  firstRunWhyClarificationDraftSchema,
  firstRunWhyClarificationResponseSchema,
} from "../../schemas/firstRun.js";

const DEFAULT_FIRST_RUN_WHY_CLARIFICATION_MODEL = "gpt-4.1-mini";
const DEFAULT_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS = 8000;
const MAX_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS = 12000;
const FIRST_RUN_WHY_CLARIFICATION_PROMPT_VERSION = "first_run_why_clarification_v1";

const firstRunWhyClarificationProviderSchema = z
  .object({
    inspirationAxes: z.array(firstRunWhyClarificationAxisSchema).max(9),
    drafts: z.array(firstRunWhyClarificationDraftSchema).max(3),
    clarification: firstRunWhyClarificationContentSchema,
    missingInformation: z.array(z.string().trim().min(1).max(80)).max(8).optional().default([]),
  })
  .strict();

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

function resolveWhyClarificationModel(app) {
  return (
    String(app?.config?.FIRST_RUN_WHY_CLARIFICATION_OPENAI_MODEL || "").trim() ||
    String(app?.config?.OPENAI_MODEL || "").trim() ||
    DEFAULT_FIRST_RUN_WHY_CLARIFICATION_MODEL
  );
}

function resolveWhyClarificationTimeoutMs(app) {
  const configuredTimeout = Number(app?.config?.FIRST_RUN_WHY_CLARIFICATION_OPENAI_TIMEOUT_MS);
  const timeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.round(configuredTimeout)
    : DEFAULT_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS;
  return Math.min(MAX_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS, Math.max(1000, timeout));
}

function buildSystemPrompt() {
  return [
    "You help users formulate the deep reason for creating a discipline system in Discip Yourself.",
    "Output valid JSON only.",
    "All user-visible text must be in natural French.",
    "Do not generate plans, schedules, occurrences, commitDraft, medical advice, clinical claims, or diagnoses.",
    "Never diagnose ADHD, HPI, depression, addiction, anxiety, burnout, or any clinical condition.",
    "For smoking or bad habits, use neutral behavior/friction wording. Do not make medical claims.",
    "Do not invent deadlines, motivations, identity claims, or domains absent from the user text.",
    "If the user text is empty or weak, propose inspiration axes and short drafts without pretending they are facts.",
  ].join("\n");
}

function buildUserPrompt(context) {
  return [
    `Mode: ${context.mode}`,
    "Return a compact why clarification payload.",
    "Hard requirements:",
    "1. clarifiedWhy must be max 700 chars.",
    "2. drafts max 3; inspirationAxes max 9.",
    "3. Keep wording premium, direct, and concrete.",
    "4. If mode is clarify, preserve the user's intent and do not add new motivations.",
    "5. If mode is inspiration, propose possible axes and drafts the user can edit.",
    "6. Do not include fields named commitDraft, occurrences, weekSchedule, diagnosis, medical, clinical, ADHD, HPI, depression, or addiction.",
    `Context: ${JSON.stringify({
      whyText: trimString(context.whyText, 1200),
      locale: context.locale,
      timezone: context.timezone,
      referenceDateKey: context.referenceDateKey,
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

async function runOpenAiWhyClarification({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("FIRST_RUN_WHY_CLARIFICATION_BACKEND_UNAVAILABLE");
  }

  const requestModel = resolveWhyClarificationModel(app);
  const requestTimeout = resolveWhyClarificationTimeoutMs(app);
  const providerStartedAt = Date.now();
  let completion;
  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: 0.2,
        response_format: zodResponseFormat(firstRunWhyClarificationProviderSchema, "first_run_why_clarification_payload"),
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(context) },
        ],
      },
      { timeout: requestTimeout }
    );
  } catch (error) {
    const providerMs = Math.max(0, Date.now() - providerStartedAt);
    if (isOpenAiRequestTimeoutError(error)) {
      throw createBackendError("FIRST_RUN_WHY_CLARIFICATION_PROVIDER_TIMEOUT", "FIRST_RUN_WHY_CLARIFICATION_PROVIDER_TIMEOUT", {
        providerStatus: "timeout",
        rejectionStage: "provider_timeout",
        rejectionReason: "provider_timeout",
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
    throw createBackendError("INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", {
      ...buildInvalidResponseDetails(),
      providerMs,
      totalMs: providerMs,
    });
  }

  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError("INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", {
      ...buildInvalidResponseDetails(),
      providerMs,
      totalMs: providerMs,
    });
  }

  try {
    return {
      candidate: firstRunWhyClarificationProviderSchema.parse(candidate),
      model: requestModel,
      promptVersion: FIRST_RUN_WHY_CLARIFICATION_PROMPT_VERSION,
      providerMs,
    };
  } catch (error) {
    throw createBackendError("INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", {
      ...buildInvalidResponseDetails({
        rejectionStage: "provider_schema",
        rejectionReason: "provider_schema_failed",
        zodIssuePaths: Array.isArray(error?.issues)
          ? error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 16)
          : [],
      }),
      providerMs,
      totalMs: providerMs,
    });
  }
}

export async function runFirstRunWhyClarificationService({ app, context }) {
  const startedAt = Date.now();
  const { candidate, model, promptVersion, providerMs } = await runOpenAiWhyClarification({ app, context });
  const response = {
    version: 1,
    source: "ai_why_clarification",
    generatedAt: new Date().toISOString(),
    mode: context.mode,
    inspirationAxes: candidate.inspirationAxes,
    drafts: candidate.drafts,
    clarification: candidate.clarification,
    ai: {
      status: "succeeded",
      missingInformation: candidate.missingInformation || [],
    },
  };

  const parsedResponse = firstRunWhyClarificationResponseSchema.safeParse(response);
  if (!parsedResponse.success) {
    throw createBackendError("INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", "INVALID_FIRST_RUN_WHY_CLARIFICATION_RESPONSE", {
      ...buildInvalidResponseDetails({
        rejectionStage: "response_schema",
        rejectionReason: "response_schema_failed",
        zodIssuePaths: parsedResponse.error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 16),
      }),
      providerMs,
      totalMs: Date.now() - startedAt,
    });
  }

  return {
    response: parsedResponse.data,
    diagnostics: {
      model,
      promptVersion,
      providerMs,
      totalMs: Date.now() - startedAt,
    },
  };
}

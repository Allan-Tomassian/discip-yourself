import { APIConnectionTimeoutError } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  assessPreparedSessionRunbookQuality,
  normalizePreparedSessionRunbook,
  normalizeSessionBlueprintSnapshot,
  PREPARED_SESSION_REJECTION_REASONS,
  PREPARED_SESSION_REJECTION_STAGES,
} from "../../../../src/features/session/sessionRunbook.js";
import {
  buildSessionToolPlan,
  normalizePreparedSessionToolPlan,
  normalizePreparedSessionToolResult,
} from "../../../../src/features/session/sessionTools.js";
import { sessionGuidanceResponseSchema } from "../../schemas/coach.js";

const PREPARE_TOOL_SOURCE = "ai_premium";
const ADAPT_TOOL_SOURCE = "ai_assist";
const DEFAULT_SESSION_GUIDANCE_PREPARE_MODEL = "gpt-5.4";
const DEFAULT_SESSION_GUIDANCE_PREPARE_TIMEOUT_MS = 12000;
const SESSION_GUIDANCE_PREPARE_PROMPT_VERSION = "session_guidance_prepare_v2";

const runbookExecutionSchema = z
  .object({
    reps: z.union([z.string().trim().max(32), z.number().int().min(1).max(999)]).nullable(),
    durationSec: z.number().int().min(1).max(1800).nullable(),
    tempo: z.string().trim().max(32).nullable(),
    deliverable: z.string().trim().max(160).nullable(),
    doneWhen: z.string().trim().max(160).nullable(),
    relaunchCue: z.string().trim().max(160).nullable(),
    restSec: z.number().int().min(0).max(300).nullable(),
  })
  .strict()
  .nullable();

const runbookItemSchema = z
  .object({
    id: z.string().max(96).nullable(),
    kind: z.string().max(32).nullable(),
    label: z.string().trim().min(1).max(56),
    minutes: z.number().int().min(1).max(30),
    guidance: z.string().trim().min(1).max(160),
    successCue: z.string().trim().max(120).nullable(),
    restSec: z.number().int().min(0).max(300).nullable(),
    transitionLabel: z.string().trim().max(80).nullable(),
    execution: runbookExecutionSchema,
  })
  .strict();

const runbookStepSchema = z
  .object({
    id: z.string().max(96).nullable(),
    label: z.string().trim().min(1).max(56),
    purpose: z.string().trim().max(120).nullable(),
    successCue: z.string().trim().max(120).nullable(),
    items: z.array(runbookItemSchema).min(1).max(4),
  })
  .strict();

const runbookObjectiveSchema = z
  .object({
    why: z.string().trim().min(1).max(160),
    successDefinition: z.string().trim().min(1).max(160),
  })
  .strict();

const sessionPrepareCandidateSchema = z
  .object({
    preparedRunbook: z
      .object({
        version: z.literal(2),
        protocolType: z.enum(["sport", "deep_work", "admin", "routine", "generic"]),
        occurrenceId: z.string().trim().min(1).max(96),
        actionId: z.string().trim().min(1).max(96),
        dateKey: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().trim().min(1).max(96),
        categoryName: z.string().trim().max(56).nullable(),
        objective: runbookObjectiveSchema,
        steps: z.array(runbookStepSchema).min(3).max(5),
      })
      .strict(),
  })
  .strict();

const sessionAdjustCandidateSchema = z
  .object({
    currentRunbook: z
      .object({
        version: z.literal(2),
        protocolType: z.enum(["sport", "deep_work", "admin", "routine", "generic"]),
        occurrenceId: z.string().trim().min(1).max(96),
        actionId: z.string().trim().min(1).max(96),
        dateKey: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().trim().min(1).max(96),
        categoryName: z.string().trim().max(56).nullable(),
        objective: runbookObjectiveSchema,
        steps: z.array(runbookStepSchema).min(3).max(5),
      })
      .strict(),
    impactNote: z.string().trim().min(1).max(220),
    guardrails: z.array(z.string().trim().min(1).max(120)).max(4),
  })
  .strict();

const paragraphBlockSchema = z
  .object({
    type: z.literal("paragraph"),
    title: z.string().trim().max(80),
    text: z.string().trim().min(1).max(420),
  })
  .strict();

const listBlockSchema = z
  .object({
    type: z.literal("list"),
    title: z.string().trim().max(80),
    items: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
  })
  .strict();

const artifactBlockSchema = z.discriminatedUnion("type", [paragraphBlockSchema, listBlockSchema]);

const sessionToolCandidateSchema = z
  .object({
    toolResult: z
      .object({
        artifactType: z.string().trim().max(32),
        title: z.string().trim().min(1).max(80),
        blocks: z.array(artifactBlockSchema).min(1).max(4),
        copyText: z.string().trim().min(1).max(1200),
      })
      .strict(),
  })
  .strict();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function createBackendError(code, message = code, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function clampText(value, maxLength = 160) {
  const source = typeof value === "string" ? value.trim() : "";
  return source ? source.slice(0, maxLength) : "";
}

function formatIssuePath(issue = null) {
  const path = Array.isArray(issue?.path) ? issue.path : [];
  return path
    .map((entry) => String(entry))
    .filter(Boolean)
    .join(".");
}

function summarizeRawRunbookShape(runbook = null) {
  const steps = Array.isArray(runbook?.steps) ? runbook.steps : [];
  const itemCount = steps.reduce(
    (count, step) => count + (Array.isArray(step?.items) ? step.items.length : 0),
    0
  );
  return {
    stepCount: steps.length || null,
    itemCount: itemCount || null,
  };
}

function buildInvalidResponseDetails(overrides = {}) {
  return {
    providerStatus: "invalid_response",
    rejectionStage: PREPARED_SESSION_REJECTION_STAGES.RUNBOOK_NORMALIZATION,
    rejectionReason: PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
    validationPassed: false,
    richnessPassed: false,
    stepCount: null,
    itemCount: null,
    zodIssuePaths: [],
    ...overrides,
  };
}

function buildProviderTimeoutDetails({ timeoutMs = null } = {}) {
  return {
    providerStatus: "timeout",
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(0, Math.round(timeoutMs)) : null,
  };
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

function buildSessionGuidanceSystemPrompt() {
  return [
    "You build premium session guidance for Discip Yourself.",
    "Output valid JSON only.",
    "All user-visible text must be in natural French.",
    "Do not produce generic filler.",
    "Do not act like a chat coach.",
    "Do not mention tools, schemas, or internal modes.",
    "Prefer concrete execution detail over motivational framing.",
  ].join("\n");
}

function resolvePreparePromptProtocolType(normalizedBlueprint, context) {
  const protocolType = String(normalizedBlueprint?.protocolType || context?.protocolType || "").trim().toLowerCase();
  if (protocolType === "sport") return "sport";
  if (protocolType === "deep_work") return "deep_work";
  if (protocolType === "admin") return "admin";
  if (protocolType === "routine") return "routine";
  return "generic";
}

function buildPrepareProtocolRequirements(protocolType) {
  if (protocolType === "sport") {
    return [
      "Sport premium hard requirements:",
      "Use one warm-up step, one main effort step, and one cooldown step.",
      "Name real exercises on items. Good labels are exercise names such as jumping jacks, air squats, fentes alternees, planche, mountain climbers, marche rapide, etirements quadriceps.",
      "Never leave final item labels as vague placeholders such as Activation generale, Mise en route, Sequence utile, Passage principal, Relance controlee, Sortie propre, Deuxieme passage.",
      "For each main effort item, include one concrete work target via execution.reps, execution.durationSec, execution.tempo, or explicit reps/seconds in guidance.",
      "Use restSec or an explicit recovery instruction on effort items, and add a short transition instruction when rhythm changes or when moving to the next item.",
      "Give concise success cues about form, rhythm, or breathing. Avoid motivational filler.",
    ];
  }

  if (protocolType === "deep_work") {
    return [
      "Deep work premium hard requirements:",
      "Every main item must describe a concrete sub-deliverable, not a generic pass through the topic.",
      "Use execution.deliverable or execution.doneWhen on the core production items when it clarifies the expected output.",
      "Include one explicit relaunch cue via execution.relaunchCue or guidance so the next restart is obvious.",
      "Avoid vague labels such as Passage principal, Trace exploitable, Premier passage utile when they are not tied to a real artifact.",
    ];
  }

  if (protocolType === "admin") {
    return [
      "Admin premium hard requirements:",
      "Each main item must name the exact admin action or document being processed.",
      "Use execution.deliverable or execution.doneWhen when it clarifies what counts as finished.",
      "Include one explicit relaunch cue for the remaining queue or the next follow-up.",
      "Avoid vague labels such as Passage principal, Trace exploitable, Premier passage utile when they are not tied to a concrete output.",
    ];
  }

  return [
    "Premium hard requirements:",
    "Name the concrete work items, not generic placeholders.",
    "Include at least one concrete completion signal and one useful relaunch or transition cue.",
  ];
}

function buildPreparePrompt(context) {
  const normalizedBlueprint = normalizeSessionBlueprintSnapshot(context.blueprintSnapshot);
  const protocolType = resolvePreparePromptProtocolType(normalizedBlueprint, context);
  const promptContext = {
    mode: "prepare",
    aiIntent: context.aiIntent,
    variant: clampText(context.variant, 32) || null,
    dateKey: context.dateKey,
    occurrenceId: context.occurrenceId,
    actionId: context.actionId,
    actionTitle: clampText(context.actionTitle, 96) || null,
    categoryName: clampText(context.categoryName, 56) || null,
    protocolType: context.protocolType,
    targetDurationMinutes: context.targetDurationMinutes,
    blueprintSnapshot: normalizedBlueprint,
    notes: clampText(context.notes, 240) || null,
  };
  return [
    "Build a premium guided runbook for one session.",
    "The nominal premium value is the detailed runbook itself.",
    "Use the blueprint and action context as the primary truth.",
    "Do not reuse fallback labels such as Bloc principal, Passage principal, Relance courte, Premier passage utile, Trace exploitable, Activation générale.",
    "Every item must be specific, executable, and context-aware.",
    "Keep technical fields compact. For ids, item kinds, transitionLabel, or execution details, use null when they add no execution value; the backend can synthesize what is missing.",
    "When useful, add execution details on items. For sport prefer execution { reps, durationSec, tempo, restSec }. For deep work/admin prefer execution { deliverable, doneWhen, relaunchCue }.",
    "Keep 3 to 5 steps and 6 to 12 items total.",
    "Return only preparedRunbook.",
    ...buildPrepareProtocolRequirements(protocolType),
    `Context: ${JSON.stringify(promptContext)}`,
  ].join("\n");
}

function buildAdjustPrompt(context) {
  return [
    "Adapt the current guided runbook for an active session.",
    "Keep the same action and objective.",
    "Do not replan the whole action from scratch.",
    "Return a revised currentRunbook, one impactNote, and up to four guardrails.",
    "Prefer conservative adjustments that preserve continuity.",
    `Context: ${JSON.stringify({
      mode: "adjust",
      aiIntent: context.aiIntent,
      dateKey: context.dateKey,
      occurrenceId: context.occurrenceId,
      actionId: context.actionId,
      actionTitle: context.actionTitle,
      categoryName: context.categoryName,
      cause: context.cause,
      strategyId: context.strategyId,
      runtimeContext: context.runtimeContext,
      currentRunbook: context.currentRunbook,
      adjustmentLineage: context.adjustmentLineage,
    })}`,
  ].join("\n");
}

function buildToolPrompt(context) {
  return [
    "Build one bounded support artifact for the current session tool request.",
    "Do not modify the runbook.",
    "Do not return a new plan.",
    "Return only toolResult.",
    `Context: ${JSON.stringify({
      mode: "tool",
      aiIntent: context.aiIntent,
      dateKey: context.dateKey,
      occurrenceId: context.occurrenceId,
      actionId: context.actionId,
      actionTitle: context.actionTitle,
      categoryName: context.categoryName,
      toolId: context.toolId,
      runtimeContext: context.runtimeContext,
      currentRunbook: context.currentRunbook,
      notes: context.notes,
    })}`,
  ].join("\n");
}

function resolvePrompt(context) {
  if (context.mode === "prepare") return buildPreparePrompt(context);
  if (context.mode === "adjust") return buildAdjustPrompt(context);
  return buildToolPrompt(context);
}

function resolveCandidateSchema(context) {
  if (context.mode === "prepare") return sessionPrepareCandidateSchema;
  if (context.mode === "adjust") return sessionAdjustCandidateSchema;
  return sessionToolCandidateSchema;
}

function resolveSchemaName(context) {
  if (context.mode === "prepare") return "session_guidance_prepare_payload";
  if (context.mode === "adjust") return "session_guidance_adjust_payload";
  return "session_guidance_tool_payload";
}

function resolveSessionGuidanceOpenAiModel(app, context) {
  if (context.mode !== "prepare") return app.config.OPENAI_MODEL;
  return String(app?.config?.SESSION_GUIDANCE_PREPARE_OPENAI_MODEL || "").trim() || DEFAULT_SESSION_GUIDANCE_PREPARE_MODEL;
}

function resolveSessionGuidanceOpenAiTimeoutMs(app, context) {
  if (context.mode !== "prepare") return null;
  const configuredTimeout = Number(app?.config?.SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? Math.max(1000, Math.round(configuredTimeout))
    : DEFAULT_SESSION_GUIDANCE_PREPARE_TIMEOUT_MS;
}

async function runOpenAiSessionGuidance({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("SESSION_GUIDANCE_BACKEND_UNAVAILABLE");
  }
  const requestOptions =
    context.mode === "prepare"
      ? { timeout: resolveSessionGuidanceOpenAiTimeoutMs(app, context) }
      : undefined;
  const requestModel = resolveSessionGuidanceOpenAiModel(app, context);
  let completion;
  try {
    completion = await app.openai.chat.completions.parse(
      {
        model: requestModel,
        temperature: context.mode === "prepare" ? 0.35 : 0.2,
        response_format: zodResponseFormat(resolveCandidateSchema(context), resolveSchemaName(context)),
        messages: [
          {
            role: "system",
            content: buildSessionGuidanceSystemPrompt(),
          },
          {
            role: "user",
            content: resolvePrompt(context),
          },
        ],
      },
      requestOptions
    );
  } catch (error) {
    if (context.mode === "prepare" && isOpenAiRequestTimeoutError(error)) {
      throw createBackendError(
        "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
        "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
        buildProviderTimeoutDetails({
          timeoutMs: requestOptions?.timeout ?? null,
        })
      );
    }
    throw error;
  }
  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throw createBackendError(
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: PREPARED_SESSION_REJECTION_STAGES.PROVIDER_PARSE,
        rejectionReason: PREPARED_SESSION_REJECTION_REASONS.PROVIDER_PARSE_FAILED,
      })
    );
  }
  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError(
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: PREPARED_SESSION_REJECTION_STAGES.PROVIDER_PARSE,
        rejectionReason: PREPARED_SESSION_REJECTION_REASONS.PROVIDER_PARSE_FAILED,
      })
    );
  }
  try {
    return {
      candidate: resolveCandidateSchema(context).parse(candidate),
      model: context.mode === "prepare" ? requestModel : null,
      promptVersion: context.mode === "prepare" ? SESSION_GUIDANCE_PREPARE_PROMPT_VERSION : null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createBackendError(
        "INVALID_SESSION_GUIDANCE_RESPONSE",
        "INVALID_SESSION_GUIDANCE_RESPONSE",
        buildInvalidResponseDetails({
          rejectionStage: PREPARED_SESSION_REJECTION_STAGES.PROVIDER_PARSE,
          rejectionReason: PREPARED_SESSION_REJECTION_REASONS.PROVIDER_PARSE_FAILED,
          zodIssuePaths: error.issues.map((issue) => formatIssuePath(issue)).filter(Boolean).slice(0, 12),
        })
      );
    }
    throw error;
  }
}

function normalizePreparePayload(candidate, context, providerMeta = null) {
  const rawRunbook = candidate?.preparedRunbook || null;
  const preparedRunbook = normalizePreparedSessionRunbook(rawRunbook);
  const quality = assessPreparedSessionRunbookQuality({
    preparedRunbook,
  });
  if (!preparedRunbook) {
    const shape = summarizeRawRunbookShape(rawRunbook);
    throw createBackendError(
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      "INVALID_SESSION_GUIDANCE_RESPONSE",
      buildInvalidResponseDetails({
        rejectionStage: PREPARED_SESSION_REJECTION_STAGES.RUNBOOK_NORMALIZATION,
        rejectionReason: PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
        stepCount: shape.stepCount,
        itemCount: shape.itemCount,
      })
    );
  }
  const localToolPlan = buildSessionToolPlan({ sessionRunbook: preparedRunbook });
  const toolPlan = normalizePreparedSessionToolPlan(localToolPlan, { sessionRunbook: preparedRunbook });
  return {
    kind: "session_guidance",
    mode: "prepare",
    payload: {
      preparedRunbook,
      toolPlan,
      quality,
    },
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      aiIntent: context.aiIntent,
      quotaRemaining: context.quotaRemaining,
      source: PREPARE_TOOL_SOURCE,
      model: providerMeta?.model || DEFAULT_SESSION_GUIDANCE_PREPARE_MODEL,
      promptVersion: providerMeta?.promptVersion || SESSION_GUIDANCE_PREPARE_PROMPT_VERSION,
    },
  };
}

function normalizeAdjustPayload(candidate, context) {
  const preparedRunbook = normalizePreparedSessionRunbook(candidate?.currentRunbook || null, {
    fallbackRunbook: context.currentRunbook,
  });
  if (!preparedRunbook) {
    throw createBackendError("INVALID_SESSION_GUIDANCE_RESPONSE");
  }
  const localToolPlan = buildSessionToolPlan({ sessionRunbook: preparedRunbook });
  const toolPlan = normalizePreparedSessionToolPlan(localToolPlan, { sessionRunbook: preparedRunbook });
  return {
    kind: "session_guidance",
    mode: "adjust",
    payload: {
      currentRunbook: preparedRunbook,
      toolPlan,
      impactNote: candidate.impactNote,
      guardrails: Array.isArray(candidate.guardrails) ? candidate.guardrails : [],
    },
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      aiIntent: context.aiIntent,
      quotaRemaining: context.quotaRemaining,
      source: ADAPT_TOOL_SOURCE,
    },
  };
}

function normalizeToolPayload(candidate, context) {
  const normalizedToolResult = normalizePreparedSessionToolResult(
    { toolResult: candidate?.toolResult || null },
    { toolId: context.toolId }
  );
  if (!normalizedToolResult?.artifact) {
    throw createBackendError("INVALID_SESSION_GUIDANCE_RESPONSE");
  }
  return {
    kind: "session_guidance",
    mode: "tool",
    payload: {
      toolResult: normalizedToolResult.artifact,
    },
    meta: {
      coachVersion: "v1",
      requestId: context.requestId,
      aiIntent: context.aiIntent,
      quotaRemaining: context.quotaRemaining,
      source: ADAPT_TOOL_SOURCE,
    },
  };
}

export async function runSessionGuidanceCoach({ app, context }) {
  const response = await runOpenAiSessionGuidance({ app, context });
  const candidate = response?.candidate || response;
  const payload =
    context.mode === "prepare" ? normalizePreparePayload(candidate, context, response)
    : context.mode === "adjust" ? normalizeAdjustPayload(candidate, context)
    : normalizeToolPayload(candidate, context);
  return sessionGuidanceResponseSchema.parse(payload);
}

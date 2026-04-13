import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  assessPreparedSessionRunbookQuality,
  normalizePreparedSessionRunbook,
} from "../../../../src/features/session/sessionRunbook.js";
import {
  buildSessionToolPlan,
  normalizePreparedSessionToolPlan,
  normalizePreparedSessionToolResult,
} from "../../../../src/features/session/sessionTools.js";
import { sessionGuidanceResponseSchema } from "../../schemas/coach.js";

const PREPARE_TOOL_SOURCE = "ai_premium";
const ADAPT_TOOL_SOURCE = "ai_assist";

const runbookItemSchema = z
  .object({
    id: z.string().max(96),
    kind: z.string().max(32),
    label: z.string().trim().min(1).max(56),
    minutes: z.number().int().min(1).max(30),
    guidance: z.string().trim().min(1).max(160),
    successCue: z.string().trim().max(120),
    restSec: z.number().int().min(0).max(300),
    transitionLabel: z.string().trim().max(80),
  })
  .strict();

const runbookStepSchema = z
  .object({
    id: z.string().max(96),
    label: z.string().trim().min(1).max(56),
    purpose: z.string().trim().max(120),
    successCue: z.string().trim().max(120),
    items: z.array(runbookItemSchema).min(2).max(4),
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
        categoryName: z.string().trim().max(56),
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
        categoryName: z.string().trim().max(56),
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

function buildPreparePrompt(context) {
  return [
    "Build a premium guided runbook for one session.",
    "The nominal premium value is the detailed runbook itself.",
    "Use the blueprint and action context as the primary truth.",
    "Do not reuse fallback labels such as Bloc principal, Passage principal, Relance courte, Premier passage utile, Trace exploitable, Activation générale.",
    "Every item must be specific, executable, and context-aware.",
    "For sport: name the exercises, sequence them, add durations or effort targets, rests when relevant, and concise success cues.",
    "For deep work: name the concrete sub-deliverables, execution order, completion criteria, and a useful relaunch cue.",
    "Keep 3 to 5 steps and 6 to 12 items total.",
    "Return only preparedRunbook.",
    `Context: ${JSON.stringify({
      mode: "prepare",
      aiIntent: context.aiIntent,
      dateKey: context.dateKey,
      occurrenceId: context.occurrenceId,
      actionId: context.actionId,
      actionTitle: context.actionTitle,
      categoryName: context.categoryName,
      protocolType: context.protocolType,
      targetDurationMinutes: context.targetDurationMinutes,
      blueprintSnapshot: context.blueprintSnapshot,
      notes: context.notes,
    })}`,
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

async function runOpenAiSessionGuidance({ app, context }) {
  if (!app.openai || !String(app?.config?.OPENAI_API_KEY || "").trim()) {
    throw createBackendError("SESSION_GUIDANCE_BACKEND_UNAVAILABLE");
  }
  const completion = await app.openai.chat.completions.parse({
    model: app.config.OPENAI_MODEL,
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
  });
  const message = completion.choices?.[0]?.message || null;
  if (!message || message.refusal) {
    throw createBackendError("INVALID_SESSION_GUIDANCE_RESPONSE");
  }
  const candidate = extractPayloadCandidate(message);
  if (!candidate) {
    throw createBackendError("INVALID_SESSION_GUIDANCE_RESPONSE");
  }
  return resolveCandidateSchema(context).parse(candidate);
}

function normalizePreparePayload(candidate, context) {
  const preparedRunbook = normalizePreparedSessionRunbook(candidate?.preparedRunbook || null);
  const quality = assessPreparedSessionRunbookQuality({
    preparedRunbook,
  });
  if (!preparedRunbook) {
    throw createBackendError("INVALID_SESSION_GUIDANCE_RESPONSE");
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
  const candidate = await runOpenAiSessionGuidance({ app, context });
  const payload =
    context.mode === "prepare" ? normalizePreparePayload(candidate, context)
    : context.mode === "adjust" ? normalizeAdjustPayload(candidate, context)
    : normalizeToolPayload(candidate, context);
  return sessionGuidanceResponseSchema.parse(payload);
}

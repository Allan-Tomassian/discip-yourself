import { z } from "zod";
import {
  TODAY_BACKEND_RESOLUTION_STATUS,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
  TODAY_INTERVENTION_TYPE,
} from "../../../src/domain/todayIntervention.js";
import { COACH_CHAT_MODES, LOCAL_ANALYSIS_SURFACES } from "../../../src/domain/aiPolicy.js";
import { AI_INTENTS } from "../../../src/domain/aiIntent.js";

const isoDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);
const fallbackReasonSchema = z.enum(["none", "quota", "timeout", "invalid_model_output", "backend_error"]);
const decisionSourceSchema = z.enum(["ai", "rules"]);
const chatModeSchema = z.enum([COACH_CHAT_MODES.CARD, COACH_CHAT_MODES.FREE, COACH_CHAT_MODES.PLAN]);
const coachLocaleSchema = z.string().trim().min(2).max(32).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const coachUseCaseSchema = z.enum(["general", "life_plan", "stats_review"]);
const aiIntentSchema = z.enum(Object.values(AI_INTENTS));
const localAnalysisSurfaceSchema = z.enum([
  LOCAL_ANALYSIS_SURFACES.PLANNING,
  LOCAL_ANALYSIS_SURFACES.PILOTAGE,
]);
const repeatSchema = z.enum(["none", "daily", "weekly"]);
const directionSchema = z.enum(["maintenir", "recalibrer", "accélérer", "alléger"]);
const interventionTypeSchema = z.enum([
  TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
  TODAY_INTERVENTION_TYPE.SESSION_RESUME,
  TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING,
  TODAY_INTERVENTION_TYPE.OVERLOAD_ADJUSTMENT,
  TODAY_INTERVENTION_TYPE.PLANNING_ASSIST,
  TODAY_INTERVENTION_TYPE.MOTIVATION_NUDGE,
  TODAY_INTERVENTION_TYPE.REVIEW_FEEDBACK,
]);

const diagnosticsSchema = z
  .object({
    resolutionStatus: z.enum([
      TODAY_BACKEND_RESOLUTION_STATUS.ACCEPTED_AI,
      TODAY_BACKEND_RESOLUTION_STATUS.REJECTED_TO_RULES,
      TODAY_BACKEND_RESOLUTION_STATUS.RULES_FALLBACK,
    ]),
    rejectionReason: z.enum([
      TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_MODEL_OUTPUT,
      TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
      TODAY_DIAGNOSTIC_REJECTION_REASON.GOVERNANCE_REJECTED,
      TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      TODAY_DIAGNOSTIC_REJECTION_REASON.NO_MATERIAL_GAIN_OVER_LOCAL,
      TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE,
      TODAY_DIAGNOSTIC_REJECTION_REASON.NO_DETERMINISTIC_SIGNAL,
      TODAY_DIAGNOSTIC_REJECTION_REASON.AMBIGUOUS_CONTEXT,
      TODAY_DIAGNOSTIC_REJECTION_REASON.WARNING_SIGNAL_TOO_WEAK,
    ]),
    canonicalContextSummary: z
      .object({
        activeDate: isoDateKey,
        isToday: z.boolean(),
        hasActiveSessionForActiveDate: z.boolean(),
        hasOpenSessionOutsideActiveDate: z.boolean(),
        futureSessionsCount: z.number().int().min(0),
        hasPlannedActionsForActiveDate: z.boolean(),
        hasFocusOccurrenceForActiveDate: z.boolean(),
      })
      .strict(),
  })
  .strict();

const actionSchema = z
  .object({
    label: z.string().max(32),
    intent: z.enum([
      "start_occurrence",
      "resume_session",
      "open_library",
      "open_pilotage",
      "open_today",
      "open_support",
    ]),
    categoryId: z.string().nullable(),
    actionId: z.string().nullable(),
    occurrenceId: z.string().nullable(),
    dateKey: isoDateKey.nullable(),
  })
  .strict();

const planCategoryDraftSchema = z
  .object({
    mode: z.enum(["existing", "suggested", "unresolved"]).optional().default("unresolved"),
    id: z.string().nullable().optional().default(null),
    label: z.string().max(96).nullable().optional().default(null),
  })
  .strict();

const planActionDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(96),
    categoryId: z.string().nullable().optional().default(null),
    outcomeId: z.string().nullable().optional().default(null),
    priority: z.enum(["prioritaire", "secondaire", "bonus"]).nullable().optional().default(null),
    repeat: repeatSchema.nullable().optional().default(null),
    oneOffDate: isoDateKey.nullable().optional().default(null),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional().default([]),
    timeMode: z.enum(["NONE", "FIXED"]).nullable().optional().default(null),
    startTime: hhmmSchema.nullable().optional().default(null),
    durationMinutes: z.number().int().min(1).max(240).nullable().optional().default(null),
    notes: z.string().max(280).nullable().optional().default(null),
  })
  .strict();

const planOutcomeDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(96),
    categoryId: z.string().nullable().optional().default(null),
    priority: z.enum(["prioritaire", "secondaire", "bonus"]).nullable().optional().default(null),
    startDate: isoDateKey.nullable().optional().default(null),
    deadline: isoDateKey.nullable().optional().default(null),
    measureType: z.string().max(48).nullable().optional().default(null),
    targetValue: z.number().positive().nullable().optional().default(null),
    notes: z.string().max(280).nullable().optional().default(null),
  })
  .strict();

const creationProposalSchema = z
  .object({
    kind: z.enum(["action", "outcome", "guided", "assistant"]),
    categoryDraft: planCategoryDraftSchema.nullable().optional().default(null),
    outcomeDraft: planOutcomeDraftSchema.nullable().optional().default(null),
    actionDrafts: z.array(planActionDraftSchema).max(6).optional().default([]),
    unresolvedQuestions: z.array(z.string().max(160)).max(4).optional().default([]),
    requiresValidation: z.literal(true).optional().default(true),
  })
  .strict();

const chatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(500),
  })
  .strict();

export const coachPayloadSchema = z
  .object({
    kind: z.enum(["now", "recovery"]),
    headline: z.string().max(72),
    reason: z.string().max(160),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.nullable(),
    suggestedDurationMin: z.number().int().min(1).max(240).nullable(),
    confidence: z.number().min(0).max(1),
    urgency: z.enum(["low", "medium", "high"]),
    uiTone: z.enum(["steady", "direct", "reset"]),
    toolIntent: z.enum([
      "suggest_start_occurrence",
      "suggest_resume_session",
      "suggest_recovery_action",
      "suggest_reschedule_option",
      "suggest_open_library",
    ]),
    rewardSuggestion: z
      .object({
        kind: z.enum(["none", "micro_action", "coins_preview", "light_reset"]),
        label: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export const coachChatCardPayloadSchema = z
  .object({
    kind: z.literal("chat"),
    headline: z.string().max(72),
    reason: z.string().max(160),
    direction: directionSchema.nullable().optional().default(null),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.nullable(),
    suggestedDurationMin: z.number().int().min(1).max(240).nullable(),
  })
  .strict();

export const coachFreeConversationPayloadSchema = z
  .object({
    kind: z.literal("conversation"),
    mode: z.literal(COACH_CHAT_MODES.FREE),
    message: z.string().trim().min(1).max(1200),
    primaryAction: actionSchema.nullable().optional().default(null),
    secondaryAction: actionSchema.nullable().optional().default(null),
    proposal: z.null().optional().default(null),
  })
  .strict();

export const coachPlanConversationPayloadSchema = z
  .object({
    kind: z.literal("conversation"),
    mode: z.literal(COACH_CHAT_MODES.PLAN),
    message: z.string().trim().min(1).max(1200),
    primaryAction: actionSchema.nullable().optional().default(null),
    secondaryAction: actionSchema.nullable().optional().default(null),
    proposal: creationProposalSchema.nullable().optional().default(null),
  })
  .strict();

export const coachConversationPayloadSchema = z.discriminatedUnion("mode", [
  coachFreeConversationPayloadSchema,
  coachPlanConversationPayloadSchema,
]);

export const coachChatPayloadSchema = z.union([coachChatCardPayloadSchema, coachConversationPayloadSchema]);

export const nowRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    surface: z.enum(["today", "session"]),
    trigger: z.enum(["manual", "screen_open", "resume"]),
    aiIntent: aiIntentSchema.optional(),
  })
  .strict();

export const recoveryRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    trigger: z.enum(["manual", "auto_slip", "resume_after_gap"]),
    aiIntent: aiIntentSchema.optional(),
  })
  .strict();

export const chatRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    message: z.string().trim().min(1).max(500),
    recentMessages: z.array(chatMessageSchema).max(6).optional().default([]),
    mode: chatModeSchema.optional().default(COACH_CHAT_MODES.CARD),
    aiIntent: aiIntentSchema.optional(),
    locale: coachLocaleSchema.optional().default("fr-FR"),
    useCase: coachUseCaseSchema.optional().default("general"),
  })
  .strict();

export const localAnalysisRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    surface: localAnalysisSurfaceSchema,
    message: z.string().trim().min(1).max(500),
    aiIntent: aiIntentSchema.optional(),
  })
  .strict();

export const coachResponseSchema = z
  .object({
    kind: z.enum(["now", "recovery"]),
    decisionSource: decisionSourceSchema,
    interventionType: interventionTypeSchema.nullable(),
    headline: z.string().max(72),
    reason: z.string().max(160),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.nullable(),
    suggestedDurationMin: z.number().int().min(1).max(240).nullable(),
    confidence: z.number().min(0).max(1),
    urgency: z.enum(["low", "medium", "high"]),
    uiTone: z.enum(["steady", "direct", "reset"]),
    toolIntent: z.enum([
      "suggest_start_occurrence",
      "suggest_resume_session",
      "suggest_recovery_action",
      "suggest_reschedule_option",
      "suggest_open_library",
    ]),
    rewardSuggestion: z
      .object({
        kind: z.enum(["none", "micro_action", "coins_preview", "light_reset"]),
        label: z.string().nullable(),
      })
      .strict(),
    meta: z
      .object({
        coachVersion: z.literal("v1"),
        requestId: z.string(),
        selectedDateKey: isoDateKey,
        activeCategoryId: z.string().nullable(),
        occurrenceId: z.string().nullable(),
        sessionId: z.string().nullable(),
        quotaRemaining: z.number().int().nullable(),
        fallbackReason: fallbackReasonSchema,
        trigger: z.enum(["manual", "screen_open", "resume", "auto_slip", "resume_after_gap"]),
        diagnostics: diagnosticsSchema,
      })
      .strict(),
  })
  .strict();

export const coachChatCardResponseSchema = z
  .object({
    kind: z.literal("chat"),
    decisionSource: decisionSourceSchema,
    headline: z.string().max(72),
    reason: z.string().max(160),
    primaryAction: actionSchema,
    secondaryAction: actionSchema.nullable(),
    suggestedDurationMin: z.number().int().min(1).max(240).nullable(),
    meta: z
      .object({
        coachVersion: z.literal("v1"),
        requestId: z.string(),
        selectedDateKey: isoDateKey,
        activeCategoryId: z.string().nullable(),
        quotaRemaining: z.number().int().nullable(),
        fallbackReason: fallbackReasonSchema,
        messagePreview: z.string().max(120).nullable(),
      })
      .strict(),
  })
  .strict();

export const coachLocalAnalysisResponseSchema = coachChatCardResponseSchema.extend({
  direction: directionSchema.nullable().optional().default(null),
});

const conversationResponseMetaSchema = z
  .object({
    coachVersion: z.literal("v1"),
    requestId: z.string(),
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable(),
    quotaRemaining: z.number().int().nullable(),
    fallbackReason: fallbackReasonSchema,
    messagePreview: z.string().max(120).nullable(),
  })
  .strict();

const coachFreeConversationResponseSchema = z
  .object({
    kind: z.literal("conversation"),
    mode: z.literal(COACH_CHAT_MODES.FREE),
    decisionSource: decisionSourceSchema,
    message: z.string().trim().min(1).max(1200),
    primaryAction: actionSchema.nullable(),
    secondaryAction: actionSchema.nullable(),
    proposal: z.null().optional().default(null),
    meta: conversationResponseMetaSchema,
  })
  .strict();

const coachPlanConversationResponseSchema = z
  .object({
    kind: z.literal("conversation"),
    mode: z.literal(COACH_CHAT_MODES.PLAN),
    decisionSource: decisionSourceSchema,
    message: z.string().trim().min(1).max(1200),
    primaryAction: actionSchema.nullable(),
    secondaryAction: actionSchema.nullable(),
    proposal: creationProposalSchema.nullable().optional().default(null),
    meta: conversationResponseMetaSchema,
  })
  .strict();

export const coachConversationResponseSchema = z.discriminatedUnion("mode", [
  coachFreeConversationResponseSchema,
  coachPlanConversationResponseSchema,
]);

export const coachChatResponseSchema = z.union([coachChatCardResponseSchema, coachConversationResponseSchema]);

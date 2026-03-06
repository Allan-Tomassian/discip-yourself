import { z } from "zod";

const isoDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const actionSchema = z
  .object({
    label: z.string().max(32),
    intent: z.enum([
      "start_occurrence",
      "resume_session",
      "open_library",
      "open_pilotage",
      "open_today",
    ]),
    categoryId: z.string().nullable(),
    actionId: z.string().nullable(),
    occurrenceId: z.string().nullable(),
    dateKey: isoDateKey.nullable(),
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

export const nowRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    surface: z.enum(["today", "session"]),
    trigger: z.enum(["manual", "screen_open", "resume"]),
  })
  .strict();

export const recoveryRequestSchema = z
  .object({
    selectedDateKey: isoDateKey,
    activeCategoryId: z.string().nullable().optional().default(null),
    trigger: z.enum(["manual", "auto_slip", "resume_after_gap"]),
  })
  .strict();

export const coachResponseSchema = z
  .object({
    kind: z.enum(["now", "recovery"]),
    decisionSource: z.enum(["ai", "rules"]),
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
        fallbackReason: z.enum(["none", "quota", "timeout", "invalid_model_output", "backend_error"]),
        trigger: z.enum(["manual", "screen_open", "resume", "auto_slip", "resume_after_gap"]),
      })
      .strict(),
  })
  .strict();

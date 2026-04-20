import { z } from "zod";

const isoDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);
const localeSchema = z.string().trim().min(2).max(32).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const capacitySchema = z.enum(["reprise", "stable", "forte"]);
const firstRunCategoryTemplateSchema = z.enum([
  "health",
  "business",
  "learning",
  "productivity",
  "personal",
  "finance",
]);
const firstRunVariantSchema = z.enum(["tenable", "ambitious"]);

export const firstRunPlanWindowSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    label: z.string().trim().max(80),
  })
  .strict();

export const firstRunCommitDraftCategorySchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    templateId: firstRunCategoryTemplateSchema,
    name: z.string().trim().min(1).max(96),
    color: z.string().trim().min(1).max(32),
    order: z.number().int().min(0).max(24),
  })
  .strict();

export const firstRunCommitDraftGoalSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    categoryId: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    type: z.literal("OUTCOME"),
    order: z.number().int().min(0).max(48),
  })
  .strict();

export const firstRunCommitDraftActionSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    categoryId: z.string().trim().min(1).max(120),
    parentGoalId: z.string().trim().min(1).max(120).nullable(),
    title: z.string().trim().min(1).max(160),
    type: z.literal("PROCESS"),
    order: z.number().int().min(0).max(96),
    repeat: z.enum(["weekly"]),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    timeMode: z.enum(["FIXED", "NONE"]),
    startTime: hhmmSchema,
    timeSlots: z.array(hhmmSchema).length(1),
    durationMinutes: z.number().int().min(5).max(240),
    sessionMinutes: z.number().int().min(5).max(240),
  })
  .strict();

const firstRunCommitDraftOccurrenceBaseShape = {
  id: z.string().trim().min(1).max(120),
  date: isoDateKey,
  start: hhmmSchema,
  durationMinutes: z.number().int().min(5).max(240),
  status: z.literal("planned"),
};

const nullableOccurrenceReferenceIdSchema = z.string().trim().min(1).max(120).nullable();
const nullableOccurrenceReferenceTitleSchema = z.string().trim().min(1).max(160).nullable();

const optionalNullableOccurrenceReferenceIdSchema = nullableOccurrenceReferenceIdSchema.optional();
const optionalNullableOccurrenceReferenceTitleSchema = nullableOccurrenceReferenceTitleSchema.optional();

export const firstRunCommitDraftOccurrenceSchema = z
  .object({
    ...firstRunCommitDraftOccurrenceBaseShape,
    actionId: z.string().trim().min(1).max(120),
  })
  .strict();

export const firstRunCommitDraftOccurrenceProviderSchema = z
  .object({
    ...firstRunCommitDraftOccurrenceBaseShape,
    actionId: optionalNullableOccurrenceReferenceIdSchema,
    goalId: optionalNullableOccurrenceReferenceIdSchema,
    actionTitle: optionalNullableOccurrenceReferenceTitleSchema,
    title: optionalNullableOccurrenceReferenceTitleSchema,
    categoryId: optionalNullableOccurrenceReferenceIdSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.actionId || value.goalId || value.actionTitle || value.title || value.categoryId) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Occurrence must reference an action or provide repair hints.",
      path: ["actionId"],
    });
  });

export const firstRunCommitDraftOccurrenceOpenAiSchema = z
  .object({
    ...firstRunCommitDraftOccurrenceBaseShape,
    actionId: nullableOccurrenceReferenceIdSchema,
    goalId: nullableOccurrenceReferenceIdSchema,
    actionTitle: nullableOccurrenceReferenceTitleSchema,
    title: nullableOccurrenceReferenceTitleSchema,
    categoryId: nullableOccurrenceReferenceIdSchema,
  })
  .strict();

export const firstRunCommitDraftSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(firstRunCommitDraftCategorySchema).min(1).max(3),
    goals: z.array(firstRunCommitDraftGoalSchema).min(1).max(4),
    actions: z.array(firstRunCommitDraftActionSchema).min(1).max(8),
    occurrences: z.array(firstRunCommitDraftOccurrenceSchema).min(1).max(14),
  })
  .strict();

export const firstRunCommitDraftProviderSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(firstRunCommitDraftCategorySchema).min(1).max(3),
    goals: z.array(firstRunCommitDraftGoalSchema).min(1).max(4),
    actions: z.array(firstRunCommitDraftActionSchema).min(1).max(8),
    occurrences: z.array(firstRunCommitDraftOccurrenceProviderSchema).min(1).max(14),
  })
  .strict();

export const firstRunCommitDraftOpenAiSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(firstRunCommitDraftCategorySchema).min(1).max(3),
    goals: z.array(firstRunCommitDraftGoalSchema).min(1).max(4),
    actions: z.array(firstRunCommitDraftActionSchema).min(1).max(8),
    occurrences: z.array(firstRunCommitDraftOccurrenceOpenAiSchema).min(1).max(14),
  })
  .strict();

export const firstRunPlanRationaleSchema = z
  .object({
    whyFit: z.string().trim().min(1).max(240),
    capacityFit: z.string().trim().min(1).max(240),
    constraintFit: z.string().trim().min(1).max(240),
  })
  .strict();

export const firstRunPlanWeekScheduleEntrySchema = z
  .object({
    dayKey: isoDateKey,
    dayLabel: z.string().trim().min(1).max(48),
    blockCount: z.number().int().min(0).max(12),
    totalMinutes: z.number().int().min(0).max(24 * 60),
    loadLabel: z.enum(["leger", "cadre", "dense"]),
    primarySlotLabel: z.string().trim().min(1).max(64),
    headline: z.string().trim().min(1).max(160),
  })
  .strict();

export const firstRunPlanRhythmGuidanceSchema = z
  .object({
    startWindow: z.string().trim().min(1).max(64),
    shutdownWindow: z.string().trim().min(1).max(64),
    confidence: z.enum(["low", "medium", "high"]),
    label: z.string().trim().min(1).max(120),
    note: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();

export const firstRunPlanRequestSchema = z
  .object({
    whyText: z.string().trim().min(1).max(1200),
    primaryGoal: z.string().trim().min(1).max(240),
    unavailableWindows: z.array(firstRunPlanWindowSchema).max(12).optional().default([]),
    preferredWindows: z.array(firstRunPlanWindowSchema).max(12).optional().default([]),
    currentCapacity: capacitySchema,
    priorityCategoryIds: z.array(firstRunCategoryTemplateSchema).max(3).optional().default([]),
    timezone: z.string().trim().min(1).max(80),
    locale: localeSchema.optional().default("fr-FR"),
    referenceDateKey: isoDateKey,
  })
  .strict();

export const firstRunPlanComparisonMetricsSchema = z
  .object({
    weeklyMinutes: z.number().int().min(0).max(7 * 24 * 60),
    totalBlocks: z.number().int().min(0).max(100),
    activeDays: z.number().int().min(0).max(7),
    recoverySlots: z.number().int().min(0).max(7),
    dailyDensity: z.enum(["respirable", "soutenue"]),
    engagementLevel: firstRunVariantSchema,
  })
  .strict();

export const firstRunPlanCategorySummarySchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(96),
    role: z.enum(["primary", "support"]),
    blockCount: z.number().int().min(0).max(28),
  })
  .strict();

export const firstRunPlanPreviewEntrySchema = z
  .object({
    dayKey: isoDateKey,
    dayLabel: z.string().trim().min(1).max(48),
    slotLabel: z.string().trim().min(1).max(48),
    categoryId: z.string().trim().min(1).max(120),
    categoryLabel: z.string().trim().min(1).max(96),
    title: z.string().trim().min(1).max(160),
    minutes: z.number().int().min(5).max(240),
  })
  .strict();

export const firstRunPlanSchema = z
  .object({
    id: firstRunVariantSchema,
    variant: firstRunVariantSchema,
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    weekGoal: z.string().trim().min(1).max(160),
    weekBenefit: z.string().trim().min(1).max(200),
    differenceNote: z.string().trim().min(1).max(200),
    comparisonMetrics: firstRunPlanComparisonMetricsSchema,
    categories: z.array(firstRunPlanCategorySummarySchema).min(1).max(3),
    preview: z.array(firstRunPlanPreviewEntrySchema).min(1).max(4),
    todayPreview: z.array(firstRunPlanPreviewEntrySchema).min(1).max(3),
    weekSchedule: z.array(firstRunPlanWeekScheduleEntrySchema).min(5).max(7),
    rhythmGuidance: firstRunPlanRhythmGuidanceSchema.nullable(),
    rationale: firstRunPlanRationaleSchema,
    commitDraft: firstRunCommitDraftSchema,
  })
  .strict();

export const firstRunPlanResponseSchema = z
  .object({
    version: z.literal(2),
    source: z.literal("ai_backend"),
    inputHash: z.string().trim().min(1).max(256),
    generatedAt: z.string().trim().min(1).max(64),
    requestId: z.string().trim().min(1).max(120),
    model: z.string().trim().min(1).max(120),
    promptVersion: z.string().trim().min(1).max(120),
    plans: z.array(firstRunPlanSchema).length(2),
  })
  .strict();

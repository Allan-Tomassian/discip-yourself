import { z } from "zod";

const isoDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);
const localeSchema = z.string().trim().min(2).max(32).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const timezoneSchema = z.string().trim().min(1).max(80);
const boundedText = (max = 600) => z.string().trim().min(1).max(max);
const evidenceSchema = z
  .object({
    source: z.string().trim().max(80).nullable(),
    dateKey: isoDateKey.nullable(),
    occurrenceId: z.string().trim().max(120).nullable(),
    historyId: z.string().trim().max(120).nullable(),
    actionId: z.string().trim().max(120).nullable(),
    goalId: z.string().trim().max(120).nullable(),
    objectiveId: z.string().trim().max(120).nullable(),
    count: z.number().int().min(0).max(999).nullable(),
    facts: z.array(z.string().trim().min(1).max(180)).max(4),
  })
  .strict();

const periodSchema = z
  .object({
    startDateKey: isoDateKey,
    endDateKey: isoDateKey,
    days: z.number().int().min(1).max(90),
  })
  .strict();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inspectPayloadShape(value, ctx, path = [], depth = 0) {
  if (typeof value === "string") {
    if (value.length > 6000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snapshot contains an oversized string.",
        path,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 120) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snapshot contains an oversized array.",
        path,
      });
    }
    value.slice(0, 130).forEach((entry, index) => inspectPayloadShape(entry, ctx, [...path, index], depth + 1));
    return;
  }
  if (!isPlainObject(value) || depth > 10) return;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase();
    if (
      normalizedKey === "rawtranscript" ||
      (normalizedKey === "rawtranscriptincluded" && entry === true) ||
      normalizedKey === "messages" ||
      normalizedKey === "rawhistory"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Snapshot must not include raw transcripts or raw history.",
        path: [...path, key],
      });
    }
    inspectPayloadShape(entry, ctx, [...path, key], depth + 1);
  }
}

export const systemAnalysisSnapshotSchema = z
  .object({
    version: z.literal(1),
    period: periodSchema,
    generatedAt: z.string().trim().min(1).max(80).optional(),
    referenceDateKey: isoDateKey,
    userWhy: z.string().trim().max(1200).optional().default(""),
    firstRunSummary: z.record(z.unknown()),
    goalsSummary: z.record(z.unknown()),
    actionsSummary: z.record(z.unknown()),
    executionStats: z.record(z.unknown()),
    sessionStats: z.record(z.unknown()),
    timePatterns: z.record(z.unknown()),
    frictionPatterns: z.record(z.unknown()),
    objectiveSignals: z.record(z.unknown()),
    planningLoadSignals: z.record(z.unknown()),
    systemSignals: z.array(z.record(z.unknown())).max(24).default([]),
    adjustDiagnosticSummary: z.record(z.unknown()),
    coachThemes: z.record(z.unknown()),
    profilePreferences: z.record(z.unknown()),
    dataLimitations: z.array(z.record(z.unknown())).max(12),
    sourceCounts: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])),
    snapshotHash: z.string().trim().min(4).max(120),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    inspectPayloadShape(snapshot, ctx);
  });

export const systemAnalysisRequestSchema = z
  .object({
    version: z.literal(1),
    snapshot: systemAnalysisSnapshotSchema,
    locale: localeSchema.optional().default("fr-FR"),
    timezone: timezoneSchema.optional().default("Europe/Paris"),
    referenceDateKey: isoDateKey,
    requestId: z.string().trim().max(120).optional().default(""),
    allowThinDataForTest: z.boolean().optional().default(false),
  })
  .strict();

const findingSchema = z
  .object({
    title: boundedText(160),
    message: boundedText(700),
    evidence: z.array(evidenceSchema).min(1).max(5),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const correctionActionSchema = z.enum(["move", "reduce_duration", "postpone", "skip_once", "protect"]);

export const systemAnalysisOccurrenceAdjustmentSchema = z
  .object({
    occurrenceId: z.string().trim().min(1).max(120),
    action: correctionActionSchema,
    proposedDateKey: isoDateKey.nullable(),
    proposedStart: hhmmSchema.nullable(),
    proposedDurationMinutes: z.number().int().min(1).max(240).nullable(),
    reason: boundedText(500),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const goalAdjustmentSchema = z
  .object({
    goalId: z.string().trim().min(1).max(120),
    action: z.enum(["protect", "pause", "split", "keep"]),
    reason: boundedText(500),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const actionAdjustmentSchema = z
  .object({
    actionId: z.string().trim().min(1).max(120),
    action: z.enum(["protect", "pause", "split", "shorten", "keep"]),
    reason: boundedText(500),
    confidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const next7DaysBlockSchema = z
  .object({
    actionId: z.string().trim().max(120).nullable(),
    occurrenceId: z.string().trim().max(120).nullable(),
    title: boundedText(160),
    start: hhmmSchema.nullable(),
    durationMinutes: z.number().int().min(1).max(240),
    reason: z.string().trim().max(300),
  })
  .strict();

const next7DaysPlanEntrySchema = z
  .object({
    dateKey: isoDateKey,
    focus: boundedText(180),
    blocks: z.array(next7DaysBlockSchema).max(8),
    totalMinutes: z.number().int().min(0).max(24 * 60),
    riskLevel: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const systemAnalysisCorrectionDraftSchema = z
  .object({
    correctedLoad: z
      .object({
        targetBlocksPerDay: z.number().min(0).max(12),
        maxDailyMinutes: z.number().int().min(0).max(24 * 60),
        reason: boundedText(600),
      })
      .strict(),
    occurrenceAdjustments: z.array(systemAnalysisOccurrenceAdjustmentSchema).max(12),
    objectiveAdjustments: z.array(goalAdjustmentSchema).max(8),
    actionAdjustments: z.array(actionAdjustmentSchema).max(8),
    next7DaysPlan: z.array(next7DaysPlanEntrySchema).max(7),
    validationRequirements: z.array(z.string().trim().min(1).max(120)).max(12),
    userConfirmationRequired: z.literal(true),
  })
  .strict();

export const systemAnalysisResultSchema = z
  .object({
    version: z.literal(1),
    period: periodSchema,
    executiveSummary: boundedText(1200),
    invisibleFriction: z.array(findingSchema).max(8),
    systemWeaknesses: z.array(findingSchema).max(8),
    strongestPatterns: z.array(findingSchema).max(8),
    recommendedCorrections: z.array(findingSchema).max(10),
    correctionDraft: systemAnalysisCorrectionDraftSchema,
    next7DaysFocus: z.array(findingSchema).max(7),
    coachQuestions: z.array(z.string().trim().min(1).max(240)).max(5),
    confidence: z.number().min(0).max(1),
    dataLimitations: z.array(z.string().trim().min(1).max(400)).min(1).max(12),
    safetyNotes: z.array(z.string().trim().min(1).max(400)).max(8),
    generatedAt: z.string().trim().min(1).max(80),
    modelMeta: z
      .object({
        model: z.string().trim().min(1).max(120),
        promptVersion: z.string().trim().min(1).max(120),
        requestId: z.string().trim().min(1).max(120),
        snapshotHash: z.string().trim().min(1).max(120).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, ctx) => {
    inspectPayloadShape(result, ctx);
  });

export const systemAnalysisProviderResponseSchema = systemAnalysisResultSchema;
export const systemAnalysisPublicResponseSchema = systemAnalysisResultSchema;

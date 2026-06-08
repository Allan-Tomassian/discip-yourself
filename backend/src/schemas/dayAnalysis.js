import { z } from "zod";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
  DAY_ANALYSIS_VERSION,
} from "../../../src/features/day-analysis/dayAnalysisTypes.js";

const isoDateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const boundedText = (max = 600) => z.string().trim().min(1).max(max);
const optionalText = (max = 600) => z.string().trim().max(max);
const nullableId = z.string().trim().max(120).nullable();
const compactRecordSchema = z.record(z.unknown());
const actionTypeSchema = z.enum(Object.values(DAY_ANALYSIS_ACTION_TYPE));
const targetTypeSchema = z.enum(Object.values(DAY_ANALYSIS_TARGET_TYPE));
const supportStatusSchema = z.enum(Object.values(DAY_ANALYSIS_SUPPORT_STATUS));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inspectSnapshotShape(value, ctx, path = [], depth = 0) {
  if (typeof value === "string") {
    if (value.length > 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day analysis snapshot contains an oversized string.",
        path,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day analysis snapshot contains an oversized array.",
        path,
      });
    }
    value.slice(0, 40).forEach((entry, index) => inspectSnapshotShape(entry, ctx, [...path, index], depth + 1));
    return;
  }
  if (!isPlainObject(value) || depth > 8) return;

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase();
    if (
      normalizedKey === "rawtranscript" ||
      normalizedKey === "rawtranscriptincluded" ||
      normalizedKey === "messages" ||
      normalizedKey === "rawhistory" ||
      normalizedKey === "userdata" ||
      normalizedKey === "appstate" ||
      normalizedKey === "categories" ||
      normalizedKey === "goals" ||
      normalizedKey === "chattranscript" ||
      normalizedKey === "sessionevents"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day analysis snapshot must not include raw app state, transcripts, or full persisted blobs.",
        path: [...path, key],
      });
    }
    inspectSnapshotShape(entry, ctx, [...path, key], depth + 1);
  }
}

const modelMetaSchema = z
  .object({
    requestId: z.string().trim().max(120).nullable().optional(),
    model: z.string().trim().max(120).nullable().optional(),
    modelClass: z.string().trim().max(120).nullable().optional(),
    promptVersion: z.string().trim().max(120).nullable().optional(),
    decisionSource: z.string().trim().max(120).nullable().optional(),
    snapshotHash: z.string().trim().max(160).nullable().optional(),
  })
  .strict();

const quotaSchema = z
  .object({
    featureId: z.string().trim().max(120),
    planTier: z.string().trim().max(80).nullable(),
    remaining: z.number().int().min(0).nullable(),
  })
  .strict();

const primaryGoalSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: boundedText(180),
    categoryId: nullableId,
    type: z.string().trim().max(80).nullable().optional(),
  })
  .strict()
  .nullable();

const firstRunSchema = z
  .object({
    status: z.string().trim().max(80).nullable(),
    appliedAt: z.string().trim().max(120).nullable(),
    planSource: z.string().trim().max(80).nullable(),
    createdActionCount: z.number().int().min(0).max(100).nullable(),
    createdOccurrenceCount: z.number().int().min(0).max(500).nullable(),
  })
  .strict()
  .nullable();

const primaryActionSchema = z
  .object({
    status: z.string().trim().max(80).nullable(),
    occurrenceId: nullableId,
    actionId: nullableId,
    title: optionalText(180),
    description: optionalText(300),
    timingLabel: optionalText(120),
    durationLabel: optionalText(80),
    primaryLabel: optionalText(120),
    reason: optionalText(180),
  })
  .strict()
  .nullable();

const snapshotOccurrenceSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    actionId: nullableId,
    objectiveId: nullableId,
    categoryId: nullableId,
    title: optionalText(180),
    dateKey: isoDateKey,
    start: z.string().trim().max(12).nullable(),
    durationMinutes: z.number().int().min(1).max(24 * 60).nullable(),
    persistedStatus: z.string().trim().max(80).nullable(),
    derivedStatus: z.string().trim().min(1).max(80),
    executionSource: z.string().trim().max(80).nullable(),
    executionReason: z.string().trim().max(120).nullable(),
    historyId: nullableId,
  })
  .strict();

const sessionHistorySchema = z
  .object({
    id: nullableId,
    occurrenceId: nullableId,
    goalId: nullableId,
    dateKey: isoDateKey,
    endedReason: z.string().trim().max(80).nullable(),
    status: z.string().trim().max(80).nullable(),
    startedAt: z.string().trim().max(120).nullable(),
    endedAt: z.string().trim().max(120).nullable(),
  })
  .strict();

const activeSessionSchema = z
  .object({
    id: nullableId,
    occurrenceId: nullableId,
    goalId: nullableId,
    dateKey: isoDateKey.nullable(),
    status: z.string().trim().max(80).nullable(),
  })
  .strict()
  .nullable();

const systemSignalSchema = z
  .object({
    id: nullableId,
    type: z.string().trim().max(80).nullable(),
    severity: z.string().trim().max(80).nullable(),
    label: optionalText(180),
    summary: optionalText(240),
  })
  .strict();

export const dayAnalysisActionSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    type: actionTypeSchema,
    label: boundedText(120),
    description: boundedText(500),
    targetType: targetTypeSchema,
    targetId: z.string().trim().min(1).max(160),
    supportStatus: supportStatusSchema,
    deterministicAction: compactRecordSchema.nullable(),
    confirmationRequired: z.boolean(),
    preview: compactRecordSchema.default({}),
  })
  .passthrough();

export const dayAnalysisSnapshotSchema = z
  .object({
    version: z.literal(DAY_ANALYSIS_VERSION),
    dayKey: isoDateKey,
    nowIso: z.string().trim().min(1).max(120),
    timezone: z.string().trim().max(80).nullable(),
    activeCategoryId: nullableId,
    primaryGoal: primaryGoalSchema,
    whyText: optionalText(320),
    firstRun: firstRunSchema,
    primaryAction: primaryActionSchema,
    occurrences: z.array(snapshotOccurrenceSchema).max(24),
    sessionHistory: z.array(sessionHistorySchema).max(12),
    activeSession: activeSessionSchema,
    systemSignals: z.array(systemSignalSchema).max(6),
    deterministicActions: z.array(dayAnalysisActionSchema).min(1).max(8),
    dataLimitations: z.array(z.string().trim().min(1).max(120)).max(12),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    inspectSnapshotShape(snapshot, ctx);
    for (const [index, occurrence] of snapshot.occurrences.entries()) {
      if (occurrence.dateKey !== snapshot.dayKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Day analysis snapshot occurrences must be scoped to dayKey.",
          path: ["occurrences", index, "dateKey"],
        });
      }
    }
    for (const [index, history] of snapshot.sessionHistory.entries()) {
      if (history.dateKey !== snapshot.dayKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Day analysis session history must be scoped to dayKey.",
          path: ["sessionHistory", index, "dateKey"],
        });
      }
    }
  });

export const dayAnalysisRequestSchema = z
  .object({
    snapshot: dayAnalysisSnapshotSchema,
    snapshotHash: z.string().trim().min(4).max(160),
    clientRequestId: z.string().trim().max(120).optional().default(""),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.snapshotHash && body.snapshotHash !== body.snapshot.snapshotHash && body.snapshot.snapshotHash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "snapshotHash must match snapshot.snapshotHash when present.",
        path: ["snapshotHash"],
      });
    }
  });

export const dayAnalysisDiagnosisSchema = z
  .object({
    title: boundedText(140),
    explanation: boundedText(600),
    evidence: z.array(z.string().trim().min(1).max(220)).min(1).max(4),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const dayAnalysisResponseActionSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    type: actionTypeSchema,
    label: boundedText(120),
    description: boundedText(500),
    targetType: targetTypeSchema,
    targetId: z.string().trim().min(1).max(160),
    supportStatus: supportStatusSchema,
    deterministicAction: compactRecordSchema.nullable(),
    confirmationRequired: z.boolean(),
    preview: compactRecordSchema,
  })
  .strict();

export const dayAnalysisProviderResponseSchema = z
  .object({
    version: z.literal(DAY_ANALYSIS_VERSION),
    dayKey: isoDateKey,
    diagnosis: dayAnalysisDiagnosisSchema,
    recommendedAction: dayAnalysisResponseActionSchema,
    alternatives: z.array(dayAnalysisResponseActionSchema).max(2),
    dataLimitations: z.array(z.string().trim().min(1).max(160)).max(6),
    userConfirmationRequired: z.literal(true),
  })
  .strict();

export const dayAnalysisPublicResponseSchema = dayAnalysisProviderResponseSchema.extend({
  modelMeta: modelMetaSchema,
  quota: quotaSchema.optional(),
});

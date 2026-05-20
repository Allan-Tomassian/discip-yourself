import { describe, expect, it } from "vitest";
import {
  SYSTEM_ANALYSIS_CORRECTION_ACTION,
  assertValidCorrectionDraft,
  assertValidSystemAnalysisResult,
  validateCorrectionDraft,
  validateSystemAnalysisResult,
} from "./systemAnalysisContract";

const snapshot = {
  version: 1,
  period: { startDateKey: "2026-05-14", endDateKey: "2026-05-20", days: 7 },
};

const state = {
  goals: [
    { id: "out-1", type: "OUTCOME", title: "Ship" },
    { id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" },
  ],
  occurrences: [
    { id: "occ-1", goalId: "act-1", date: "2026-05-20", start: "09:00", status: "planned" },
  ],
};

function legalCorrectionDraft(overrides = {}) {
  return {
    correctedLoad: {
      targetBlocksPerDay: 2,
      maxDailyMinutes: 60,
      reason: "Charge plus tenable.",
    },
    occurrenceAdjustments: [
      {
        occurrenceId: "occ-1",
        action: SYSTEM_ANALYSIS_CORRECTION_ACTION.MOVE,
        proposedDateKey: "2026-05-21",
        proposedStart: "10:00",
        reason: "Le matin est saturé.",
        confidence: 0.8,
      },
    ],
    objectiveAdjustments: [{ goalId: "out-1", action: "keep", reason: "Objectif encore pertinent." }],
    actionAdjustments: [{ actionId: "act-1", action: "protect", reason: "Action motrice." }],
    next7DaysPlan: [],
    validationRequirements: ["user_confirmation"],
    userConfirmationRequired: true,
    ...overrides,
  };
}

function legalResult(overrides = {}) {
  return {
    version: 1,
    period: snapshot.period,
    executiveSummary: "Le système est clair mais la charge doit être réduite.",
    invisibleFriction: [],
    systemWeaknesses: [],
    strongestPatterns: [],
    recommendedCorrections: [],
    correctionDraft: legalCorrectionDraft(),
    next7DaysFocus: [],
    coachQuestions: [],
    confidence: 0.72,
    dataLimitations: [],
    safetyNotes: [],
    generatedAt: "2026-05-20T12:00:00.000Z",
    modelMeta: { model: "test", promptVersion: "v1", requestId: "req-1" },
    ...overrides,
  };
}

function issueCodes(result) {
  return result.issues.map((issue) => issue.code);
}

describe("validateCorrectionDraft", () => {
  it("validates a legal occurrence adjustment", () => {
    const result = validateCorrectionDraft(legalCorrectionDraft(), { snapshot, state });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() => assertValidCorrectionDraft(legalCorrectionDraft(), { snapshot, state })).not.toThrow();
  });

  it("fails when an occurrence ID is missing", () => {
    const result = validateCorrectionDraft(
      legalCorrectionDraft({
        occurrenceAdjustments: [
          {
            occurrenceId: "missing-occ",
            action: "move",
            proposedDateKey: "2026-05-21",
            proposedStart: "10:00",
          },
        ],
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("CORRECTION_OCCURRENCE_MISSING");
  });

  it("fails invalid occurrence actions", () => {
    const result = validateCorrectionDraft(
      legalCorrectionDraft({
        occurrenceAdjustments: [{ occurrenceId: "occ-1", action: "delete_forever" }],
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("CORRECTION_ACTION_INVALID");
  });

  it("fails invalid dates, times, and durations", () => {
    const result = validateCorrectionDraft(
      legalCorrectionDraft({
        occurrenceAdjustments: [
          { occurrenceId: "occ-1", action: "move", proposedDateKey: "bad-date", proposedStart: "99:99" },
          { occurrenceId: "occ-1", action: "reduce_duration", proposedDurationMinutes: 0 },
        ],
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toEqual(
      expect.arrayContaining(["CORRECTION_DATE_INVALID", "CORRECTION_TIME_INVALID", "CORRECTION_DURATION_INVALID"])
    );
  });

  it("fails direct persisted occurrence objects and fields from AI", () => {
    const result = validateCorrectionDraft(
      legalCorrectionDraft({
        occurrenceAdjustments: [
          {
            occurrenceId: "occ-1",
            action: "move",
            proposedDateKey: "2026-05-21",
            proposedStart: "10:00",
            status: "planned",
          },
        ],
        occurrence: { id: "occ-1", status: "done" },
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toEqual(
      expect.arrayContaining(["DIRECT_PERSISTED_OBJECT_FROM_AI", "DIRECT_OCCURRENCE_FIELD_FROM_AI"])
    );
  });

  it("fails when user confirmation is missing", () => {
    const result = validateCorrectionDraft(
      legalCorrectionDraft({ userConfirmationRequired: false }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("USER_CONFIRMATION_REQUIRED_MISSING");
  });
});

describe("validateSystemAnalysisResult", () => {
  it("validates a legal result", () => {
    const result = validateSystemAnalysisResult(legalResult(), { snapshot, state });

    expect(result.ok).toBe(true);
    expect(() => assertValidSystemAnalysisResult(legalResult(), { snapshot, state })).not.toThrow();
  });

  it("requires data limitations", () => {
    const source = legalResult();
    delete source.dataLimitations;
    const result = validateSystemAnalysisResult(source, { snapshot, state });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("DATA_LIMITATIONS_REQUIRED");
  });

  it("rejects unsupported medical claims", () => {
    const result = validateSystemAnalysisResult(
      legalResult({ executiveSummary: "Ce système diagnostique une dépression clinique." }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("UNSUPPORTED_MEDICAL_CLAIM");
  });

  it("warns on guilt-oriented language", () => {
    const result = validateSystemAnalysisResult(
      legalResult({ executiveSummary: "Tu es paresseux, il faut forcer." }),
      { snapshot, state }
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "GUILT_LANGUAGE_DETECTED", severity: "warning" })])
    );
  });

  it("fails when the result period does not match the snapshot", () => {
    const result = validateSystemAnalysisResult(
      legalResult({ period: { startDateKey: "2026-05-01", endDateKey: "2026-05-07", days: 7 } }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("SYSTEM_ANALYSIS_PERIOD_MISMATCH");
  });

  it("fails claims that reference nonexistent evidence IDs", () => {
    const result = validateSystemAnalysisResult(
      legalResult({
        invisibleFriction: [{ title: "Bloc invisible", occurrenceId: "missing-occ" }],
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("UNKNOWN_EVIDENCE_OCCURRENCE");
  });
});

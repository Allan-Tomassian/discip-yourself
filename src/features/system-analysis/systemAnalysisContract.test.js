import { describe, expect, it } from "vitest";
import {
  SYSTEM_ANALYSIS_CONFIRMATION_LEVEL,
  SYSTEM_ANALYSIS_CORRECTION_ACTION,
  SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION,
  SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE,
  SYSTEM_ANALYSIS_DRAFT_VERSION,
  SYSTEM_ANALYSIS_MODE,
  SYSTEM_ANALYSIS_RESULT_VERSION,
  SYSTEM_ANALYSIS_SUPPORT_STATUS,
  assertValidCorrectionDraft,
  assertValidSystemAnalysisResult,
  validateCorrectionDraft,
  validateSystemAnalysisResult,
} from "./systemAnalysisContract";

const snapshot = {
  version: 1,
  period: { startDateKey: "2026-05-14", endDateKey: "2026-05-20", days: 7 },
  plannedSystem: {
    capacity: { dailyMinutes: 60 },
    unavailableWindows: [
      { id: "no-work", daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startTime: "18:00", endTime: "22:00" },
    ],
  },
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

function legalCorrectionItem(overrides = {}) {
  return {
    id: "ci-move-1",
    type: "occurrence_move",
    targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE,
    targetId: "occ-1",
    action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE,
    title: "Déplacer le bloc",
    whatChanges: "Déplacer le bloc Deep work vers un créneau plus fiable.",
    why: "Le créneau actuel est exposé.",
    evidence: [{ occurrenceId: "occ-1", facts: ["Bloc planifié actuel."] }],
    expectedImpact: "Rendre le bloc plus exécutable.",
    risk: "Risque faible si le créneau reste disponible.",
    confidence: 0.8,
    supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    destructive: false,
    confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.STANDARD,
    validationRequirements: ["user_confirmation"],
    proposedDateKey: "2026-05-21",
    proposedStart: "10:00",
    ...overrides,
  };
}

function legalV2CorrectionDraft(overrides = {}) {
  return {
    ...legalCorrectionDraft(),
    version: SYSTEM_ANALYSIS_DRAFT_VERSION.V2,
    correctionItems: [
      legalCorrectionItem(),
      legalCorrectionItem({
        id: "ci-reduce-1",
        type: "occurrence_reduce",
        action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE,
        title: "Réduire la durée",
        whatChanges: "Passer le bloc à 25 minutes.",
        proposedDateKey: undefined,
        proposedStart: undefined,
        proposedDurationMinutes: 25,
      }),
    ],
    ...overrides,
  };
}

function legalV2Result(overrides = {}) {
  return legalResult({
    version: SYSTEM_ANALYSIS_RESULT_VERSION.V2,
    analysisMode: SYSTEM_ANALYSIS_MODE.HYBRID,
    diagnosisSummary: {
      primaryFinding: "Le système est encore trop concentré.",
      risk: "Le bloc principal peut devenir fragile.",
      opportunity: "Un créneau plus fiable existe.",
      evidence: [{ occurrenceId: "occ-1", facts: ["Bloc planifié actuel."] }],
      confidence: 0.74,
    },
    correctionDraft: legalV2CorrectionDraft(),
    ...overrides,
  });
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

  it("validates a legal v2 correction draft with applicable occurrence move and reduce items", () => {
    const result = validateCorrectionDraft(legalV2CorrectionDraft(), {
      snapshot,
      state,
      resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2,
    });

    expect(result.ok).toBe(true);
    expect(result.normalized.version).toBe(SYSTEM_ANALYSIS_DRAFT_VERSION.V2);
    expect(result.normalized.correctionItems).toHaveLength(2);
    expect(result.normalized.correctionItems[0]).toMatchObject({
      supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
      proposedDateKey: "2026-05-21",
      proposedStart: "10:00",
    });
    expect(result.normalized.correctionItems[1]).toMatchObject({
      action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE,
      proposedDurationMinutes: 25,
    });
  });

  it("fails v2 drafts without version or correctionItems", () => {
    const missingVersion = validateCorrectionDraft(
      { ...legalV2CorrectionDraft(), version: undefined },
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );
    const missingItems = validateCorrectionDraft(
      { ...legalV2CorrectionDraft(), correctionItems: undefined },
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(missingVersion.ok).toBe(false);
    expect(issueCodes(missingVersion)).toContain("CORRECTION_DRAFT_VERSION_INVALID");
    expect(missingItems.ok).toBe(false);
    expect(issueCodes(missingItems)).toContain("CORRECTION_ITEMS_REQUIRED");
  });

  it("fails direct persisted objects inside v2 correctionItems", () => {
    const result = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({ goal: { id: "out-1", title: "Persisted object" } }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("DIRECT_PERSISTED_OBJECT_FROM_AI");
  });

  it("fails unknown correction item evidence references", () => {
    const result = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            evidence: [
              { occurrenceId: "missing-occ" },
              { objectiveId: "missing-objective" },
              { actionId: "missing-action" },
            ],
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toEqual(expect.arrayContaining([
      "UNKNOWN_EVIDENCE_OCCURRENCE",
      "UNKNOWN_EVIDENCE_OBJECTIVE",
      "UNKNOWN_EVIDENCE_ACTION",
    ]));
  });

  it("fails unknown v2 correction item targets unless the item is an add proposal", () => {
    const unknownTarget = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [legalCorrectionItem({ targetId: "missing-occ" })],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );
    const addProposal = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            id: "ci-add-action",
            targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION,
            targetId: "",
            action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.ADD,
            supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(unknownTarget.ok).toBe(false);
    expect(issueCodes(unknownTarget)).toContain("UNKNOWN_EVIDENCE_OCCURRENCE");
    expect(addProposal.ok).toBe(true);
  });


  it("fails destructive remove items without destructive confirmation", () => {
    const result = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REMOVE,
            supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
            destructive: false,
            confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.STANDARD,
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("DESTRUCTIVE_REMOVE_REQUIRES_CONFIRMATION");
  });

  it("fails destructive applicable items and non-occurrence applicable proposals", () => {
    const destructive = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            destructive: true,
            confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.DESTRUCTIVE,
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );
    const objectiveApplicable = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE,
            targetId: "out-1",
            action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.PROTECT,
            destructive: true,
            confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.DESTRUCTIVE,
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(destructive.ok).toBe(false);
    expect(issueCodes(destructive)).toContain("DESTRUCTIVE_CORRECTION_ITEM_CANNOT_BE_APPLICABLE");
    expect(objectiveApplicable.ok).toBe(false);
    expect(issueCodes(objectiveApplicable)).toEqual(expect.arrayContaining([
      "DESTRUCTIVE_CORRECTION_ITEM_CANNOT_BE_APPLICABLE",
      "CORRECTION_ITEM_APPLICABLE_TARGET_UNSUPPORTED",
      "CORRECTION_ITEM_APPLICABLE_ACTION_UNSUPPORTED",
    ]));
  });

  it("fails proposed time conflicts and load above declared capacity", () => {
    const timeConflict = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [legalCorrectionItem({ proposedStart: "19:00" })],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );
    const loadConflict = validateCorrectionDraft(
      legalV2CorrectionDraft({
        correctionItems: [
          legalCorrectionItem({
            id: "ci-load",
            targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SYSTEM,
            targetId: "",
            action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REBALANCE,
            supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
            proposedLoad: { maxDailyMinutes: 90 },
          }),
        ],
      }),
      { snapshot, state, resultVersion: SYSTEM_ANALYSIS_RESULT_VERSION.V2 }
    );

    expect(timeConflict.ok).toBe(false);
    expect(issueCodes(timeConflict)).toContain("CORRECTION_ITEM_UNAVAILABLE_WINDOW_CONFLICT");
    expect(loadConflict.ok).toBe(false);
    expect(issueCodes(loadConflict)).toContain("CORRECTION_ITEM_LOAD_EXCEEDS_CAPACITY");
  });
});

describe("validateSystemAnalysisResult", () => {
  it("validates a legal result", () => {
    const result = validateSystemAnalysisResult(legalResult(), { snapshot, state });

    expect(result.ok).toBe(true);
    expect(() => assertValidSystemAnalysisResult(legalResult(), { snapshot, state })).not.toThrow();
  });

  it("validates and preserves a legal v2 result", () => {
    const result = validateSystemAnalysisResult(legalV2Result(), { snapshot, state });

    expect(result.ok).toBe(true);
    expect(result.normalized.version).toBe(SYSTEM_ANALYSIS_RESULT_VERSION.V2);
    expect(result.normalized.analysisMode).toBe(SYSTEM_ANALYSIS_MODE.HYBRID);
    expect(result.normalized.diagnosisSummary).toMatchObject({
      primaryFinding: "Le système est encore trop concentré.",
      confidence: 0.74,
    });
    expect(result.normalized.correctionDraft.correctionItems).toHaveLength(2);
    expect(() => assertValidSystemAnalysisResult(legalV2Result(), { snapshot, state })).not.toThrow();
  });

  it("fails invalid v2 analysis mode and diagnosis summary", () => {
    const result = validateSystemAnalysisResult(
      legalV2Result({
        analysisMode: "deep_psychological_analysis",
        diagnosisSummary: {
          primaryFinding: "",
          risk: "Risque.",
          opportunity: "Opportunité.",
          evidence: "not-array",
          confidence: 2,
        },
      }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toEqual(expect.arrayContaining([
      "ANALYSIS_MODE_INVALID",
      "DIAGNOSIS_SUMMARY_FIELD_REQUIRED",
      "DIAGNOSIS_SUMMARY_EVIDENCE_REQUIRED",
      "DIAGNOSIS_SUMMARY_CONFIDENCE_INVALID",
    ]));
  });

  it("requires data limitations", () => {
    const source = legalResult();
    delete source.dataLimitations;
    const result = validateSystemAnalysisResult(source, { snapshot, state });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("DATA_LIMITATIONS_REQUIRED");
  });

  it("requires data limitations on v2 results", () => {
    const source = legalV2Result();
    delete source.dataLimitations;
    const result = validateSystemAnalysisResult(source, { snapshot, state });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("DATA_LIMITATIONS_REQUIRED");
  });

  it("rejects unsupported medical claims", () => {
    const result = validateSystemAnalysisResult(
      legalV2Result({ executiveSummary: "Ce système diagnostique une dépression clinique." }),
      { snapshot, state }
    );

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("UNSUPPORTED_MEDICAL_CLAIM");
  });

  it("warns on guilt-oriented language", () => {
    const result = validateSystemAnalysisResult(
      legalV2Result({ executiveSummary: "Tu es paresseux, il faut forcer." }),
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

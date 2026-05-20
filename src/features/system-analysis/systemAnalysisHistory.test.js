import { describe, expect, it } from "vitest";
import {
  SYSTEM_ANALYSIS_HISTORY_MAX_RECORDS,
  SYSTEM_ANALYSIS_RECORD_STATUS,
  createSystemAnalysisRecord,
  ensureSystemAnalysisHistoryState,
  findReusableSystemAnalysisRecord,
  getLatestSystemAnalysisRecord,
  markSystemAnalysisRecordApplied,
  upsertSystemAnalysisRecord,
  buildSystemAnalysisHistoryDisplayModel,
} from "./systemAnalysisHistory";
import { SYSTEM_ANALYSIS_CORRECTION_ACTION } from "./systemAnalysisContract";

const PERIOD = { startDateKey: "2026-05-14", endDateKey: "2026-05-20", days: 7 };

function snapshotFixture(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    generatedAt: "2026-05-20T12:00:00.000Z",
    referenceDateKey: "2026-05-20",
    sourceCounts: { occurrences: 1, goals: 2 },
    dataLimitations: ["Snapshot compact."],
    snapshotHash: "snapshot_hash_current",
    rawCoachTranscript: "this must never be persisted",
    rawOccurrences: [{ id: "occ-raw", status: "planned" }],
    ...overrides,
  };
}

function stateFixture() {
  return {
    goals: [
      { id: "out-1", type: "OUTCOME", title: "Ship" },
      { id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" },
    ],
    occurrences: [
      { id: "occ-1", goalId: "act-1", date: "2026-05-20", start: "09:00", status: "planned" },
    ],
  };
}

function legalResult(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    executiveSummary: "Le système avance mais la charge doit être mieux répartie.",
    invisibleFriction: [{ title: "Charge concentrée", occurrenceId: "occ-1" }],
    systemWeaknesses: [],
    strongestPatterns: [],
    recommendedCorrections: [{ title: "Déplacer le bloc", occurrenceId: "occ-1" }],
    correctionDraft: {
      correctedLoad: {
        targetBlocksPerDay: 2,
        maxDailyMinutes: 90,
        reason: "Charge plus tenable.",
      },
      occurrenceAdjustments: [{
        occurrenceId: "occ-1",
        action: SYSTEM_ANALYSIS_CORRECTION_ACTION.REDUCE_DURATION,
        proposedDurationMinutes: 30,
        reason: "Version plus faisable.",
        confidence: 0.8,
      }],
      objectiveAdjustments: [],
      actionAdjustments: [],
      next7DaysPlan: [],
      validationRequirements: ["user_confirmation"],
      userConfirmationRequired: true,
    },
    next7DaysFocus: [{ title: "Protéger deux blocs courts" }],
    coachQuestions: [],
    confidence: 0.72,
    dataLimitations: ["Snapshot compact."],
    safetyNotes: [],
    generatedAt: "2026-05-20T12:30:00.000Z",
    modelMeta: { model: "test", promptVersion: "system_analysis_v1_0", requestId: "req-1" },
    ...overrides,
  };
}

function validRecord(id, generatedAt, overrides = {}) {
  return {
    id,
    version: 1,
    source: "premium_system_analysis",
    status: SYSTEM_ANALYSIS_RECORD_STATUS.COMPLETED,
    snapshotHash: `hash_${id}`,
    period: PERIOD,
    referenceDateKey: "2026-05-20",
    generatedAt,
    savedAt: generatedAt,
    result: legalResult({ generatedAt, modelMeta: { requestId: id } }),
    summary: { executiveSummary: `Résumé ${id}` },
    eligibilityAtRun: { eligible: true },
    appliedCorrectionIds: [],
    changedOccurrenceIds: [],
    appliedAt: null,
    modelMeta: { requestId: id },
    snapshotMeta: { sourceCounts: { occurrences: 1 }, dataLimitations: ["compact"] },
    ...overrides,
  };
}

describe("systemAnalysisHistory", () => {
  it("stores only validated results and rejects invalid results", () => {
    const recordResult = createSystemAnalysisRecord({
      result: legalResult(),
      snapshot: snapshotFixture(),
      eligibility: { eligible: true },
      state: stateFixture(),
      now: new Date("2026-05-20T13:00:00.000Z"),
    });
    const invalid = createSystemAnalysisRecord({
      result: legalResult({ period: { startDateKey: "2026-05-01", endDateKey: "2026-05-07", days: 7 } }),
      snapshot: snapshotFixture(),
      eligibility: { eligible: true },
      state: stateFixture(),
    });

    expect(recordResult.ok).toBe(true);
    expect(recordResult.record).toMatchObject({
      version: 1,
      source: "premium_system_analysis",
      status: SYSTEM_ANALYSIS_RECORD_STATUS.COMPLETED,
      snapshotHash: "snapshot_hash_current",
      period: PERIOD,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.record).toBeNull();
  });

  it("does not persist raw snapshots or raw transcripts", () => {
    const { record } = createSystemAnalysisRecord({
      result: legalResult(),
      snapshot: snapshotFixture(),
      eligibility: { eligible: true },
      state: stateFixture(),
    });

    const serialized = JSON.stringify(record);
    expect(serialized).toContain("snapshot_hash_current");
    expect(serialized).toContain("Snapshot compact");
    expect(serialized).not.toContain("rawCoachTranscript");
    expect(serialized).not.toContain("this must never be persisted");
    expect(serialized).not.toContain("occ-raw");
  });

  it("keeps newest analyses first and caps history to the latest six records", () => {
    const records = Array.from({ length: 8 }, (_, index) => validRecord(
      `record_${index}`,
      `2026-05-${String(13 + index).padStart(2, "0")}T12:00:00.000Z`
    ));
    const history = records.reduce((current, record) => upsertSystemAnalysisRecord(current, record), null);

    expect(history.analyses).toHaveLength(SYSTEM_ANALYSIS_HISTORY_MAX_RECORDS);
    expect(history.analyses[0].id).toBe("record_7");
    expect(history.latestAnalysisId).toBe("record_7");
    expect(history.analyses.some((record) => record.id === "record_0")).toBe(false);
  });

  it("finds reusable records only for exact snapshot hash and period matches", () => {
    const record = validRecord("record_current", "2026-05-20T12:00:00.000Z", {
      snapshotHash: "exact_hash",
      period: PERIOD,
    });
    const history = upsertSystemAnalysisRecord(null, record);

    expect(findReusableSystemAnalysisRecord(history, { snapshotHash: "exact_hash", period: PERIOD })?.id).toBe("record_current");
    expect(findReusableSystemAnalysisRecord(history, {
      snapshotHash: "exact_hash",
      period: { startDateKey: "2026-05-13", endDateKey: "2026-05-20", days: 8 },
    })).toBeNull();
    expect(findReusableSystemAnalysisRecord(history, { snapshotHash: "other_hash", period: PERIOD })).toBeNull();
  });

  it("marks applied correction metadata on the right record and updates status", () => {
    const history = upsertSystemAnalysisRecord(null, validRecord("analysis_1", "2026-05-20T12:00:00.000Z"));
    const partial = markSystemAnalysisRecordApplied(history, {
      analysisId: "analysis_1",
      appliedItems: [{ id: "occurrence:0:occ-1:reduce_duration" }],
      changedOccurrenceIds: ["occ-1"],
      appliedAt: "2026-05-20T14:00:00.000Z",
      totalApplicableIds: 2,
    });
    const complete = markSystemAnalysisRecordApplied(partial, {
      analysisId: "analysis_1",
      appliedItems: ["occurrence:1:occ-2:move"],
      changedOccurrenceIds: ["occ-2"],
      appliedAt: "2026-05-20T15:00:00.000Z",
      totalApplicableIds: 2,
    });

    expect(getLatestSystemAnalysisRecord(partial)).toMatchObject({
      status: SYSTEM_ANALYSIS_RECORD_STATUS.PARTIALLY_APPLIED,
      appliedCorrectionIds: ["occurrence:0:occ-1:reduce_duration"],
      changedOccurrenceIds: ["occ-1"],
      appliedAt: "2026-05-20T14:00:00.000Z",
    });
    expect(getLatestSystemAnalysisRecord(complete)).toMatchObject({
      status: SYSTEM_ANALYSIS_RECORD_STATUS.APPLIED,
      appliedCorrectionIds: ["occurrence:0:occ-1:reduce_duration", "occurrence:1:occ-2:move"],
      changedOccurrenceIds: ["occ-1", "occ-2"],
      appliedAt: "2026-05-20T15:00:00.000Z",
    });
  });

  it("preserves reload-shaped latest analysis records and applied metadata", () => {
    const rawHistory = {
      version: 1,
      latestAnalysisId: "analysis_1",
      analyses: [
        validRecord("analysis_1", "2026-05-20T12:00:00.000Z", {
          status: SYSTEM_ANALYSIS_RECORD_STATUS.APPLIED,
          appliedCorrectionIds: ["occurrence:0:occ-1:reduce_duration"],
          changedOccurrenceIds: ["occ-1"],
          appliedAt: "2026-05-20T14:00:00.000Z",
        }),
      ],
    };

    const normalized = ensureSystemAnalysisHistoryState(rawHistory);
    const latest = getLatestSystemAnalysisRecord(normalized);

    expect(normalized.latestAnalysisId).toBe("analysis_1");
    expect(latest).toMatchObject({
      id: "analysis_1",
      status: SYSTEM_ANALYSIS_RECORD_STATUS.APPLIED,
      appliedCorrectionIds: ["occurrence:0:occ-1:reduce_duration"],
      changedOccurrenceIds: ["occ-1"],
      appliedAt: "2026-05-20T14:00:00.000Z",
    });
  });

  it("normalizes malformed history without throwing", () => {
    const history = ensureSystemAnalysisHistoryState({
      latestAnalysisId: "missing",
      analyses: [
        null,
        { id: "", snapshotHash: "bad" },
        validRecord("valid", "2026-05-20T12:00:00.000Z"),
      ],
    });

    expect(history).toEqual(expect.objectContaining({
      version: 1,
      latestAnalysisId: "valid",
    }));
    expect(history.analyses).toHaveLength(1);
  });

  it("builds a compact latest-analysis display model with stale state", () => {
    const history = upsertSystemAnalysisRecord(null, validRecord("latest", "2026-05-20T12:00:00.000Z", {
      snapshotHash: "old_hash",
    }));
    const model = buildSystemAnalysisHistoryDisplayModel({
      history,
      currentSnapshot: snapshotFixture({ snapshotHash: "new_hash" }),
      activeDateKey: "2026-05-20",
    });

    expect(model.visible).toBe(true);
    expect(model.title).toBe("Dernière analyse");
    expect(model.isStale).toBe(true);
    expect(model.staleNote).toContain("Ton système a changé");
  });

  it("does not mark latest-analysis display stale when snapshot hash and period still match", () => {
    const history = upsertSystemAnalysisRecord(null, validRecord("latest", "2026-05-20T12:00:00.000Z", {
      snapshotHash: "snapshot_hash_current",
      period: PERIOD,
    }));
    const model = buildSystemAnalysisHistoryDisplayModel({
      history,
      currentSnapshot: snapshotFixture({ snapshotHash: "snapshot_hash_current", period: PERIOD }),
      activeDateKey: "2026-05-20",
    });

    expect(model.visible).toBe(true);
    expect(model.isStale).toBe(false);
    expect(model.staleNote).toBe("");
  });
});

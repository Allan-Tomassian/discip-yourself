import { describe, expect, it } from "vitest";
import { buildDayAnalysisCacheKey, buildDayAnalysisSnapshotHash } from "./dayAnalysisCache";
import { buildDayAnalysisCandidates } from "./dayAnalysisCandidates";
import { validateDayAnalysisResult } from "./dayAnalysisContract";
import { buildDayAnalysisSnapshot } from "./dayAnalysisSnapshot";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_VERSION,
} from "./dayAnalysisTypes";

const DAY = "2026-04-19";
const NOW = new Date(2026, 3, 19, 10, 0, 0);

function baseState({ occurrences = [], sessionHistory = [], goals = null, ui = {} } = {}) {
  const outcome = {
    id: "obj_launch",
    type: "OUTCOME",
    title: "Publier l’app",
    categoryId: "business",
  };
  const action = {
    id: "act_launch",
    type: "PROCESS",
    title: "Préparer la publication",
    outcomeId: outcome.id,
    categoryId: "business",
    durationMinutes: 60,
  };
  return {
    goals: goals || [outcome, action],
    occurrences,
    sessionHistory,
    ui: {
      firstRun: {
        whyText: "Je veux lancer mon app proprement.",
        status: "completed",
        planSource: "local",
      },
      ...ui,
    },
  };
}

function occurrence(overrides = {}) {
  return {
    id: "occ_launch",
    actionId: "act_launch",
    goalId: "act_launch",
    date: DAY,
    start: "11:00",
    durationMinutes: 60,
    status: "planned",
    ...overrides,
  };
}

function todayData(overrides = {}) {
  return {
    primaryAction: {
      status: "planned",
      occurrenceId: "occ_launch",
      actionId: "act_launch",
      title: "Préparer la publication",
      categoryId: "business",
      ...overrides.primaryAction,
    },
    ...overrides,
  };
}

describe("day analysis snapshot", () => {
  it("builds a bounded today-only snapshot with deterministic actions", () => {
    const state = baseState({
      occurrences: [
        occurrence(),
        occurrence({ id: "occ_tomorrow", date: "2026-04-20", start: "09:00" }),
      ],
    });

    const snapshot = buildDayAnalysisSnapshot({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(snapshot.version).toBe(DAY_ANALYSIS_VERSION);
    expect(snapshot.dayKey).toBe(DAY);
    expect(snapshot.primaryGoal).toMatchObject({
      id: "obj_launch",
      title: "Publier l’app",
    });
    expect(snapshot.occurrences).toHaveLength(1);
    expect(snapshot.occurrences[0]).toMatchObject({
      id: "occ_launch",
      derivedStatus: "planned",
    });
    expect(snapshot.deterministicActions.length).toBeGreaterThan(0);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it("captures active session state without mutating app data", () => {
    const state = baseState({
      occurrences: [occurrence()],
      ui: {
        activeSession: {
          id: "session_1",
          occurrenceId: "occ_launch",
          runtimePhase: "in_progress",
          dateKey: DAY,
        },
      },
    });
    const before = JSON.stringify(state);

    const snapshot = buildDayAnalysisSnapshot({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(snapshot.activeSession).toMatchObject({
      id: "session_1",
      occurrenceId: "occ_launch",
      status: "in_progress",
    });
    expect(snapshot.occurrences[0].derivedStatus).toBe("active");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("day analysis deterministic candidates", () => {
  it("returns a recovery candidate for a late block", () => {
    const state = baseState({
      occurrences: [occurrence({ start: "08:30", durationMinutes: 30 })],
    });

    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(candidates).toContainEqual(
      expect.objectContaining({
        type: DAY_ANALYSIS_ACTION_TYPE.RECOVER_BLOCK,
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET,
        deterministicAction: expect.objectContaining({
          kind: "recovery",
          context: "late",
          occurrenceId: "occ_launch",
        }),
      }),
    );
  });

  it("returns a recovery candidate for missed blocks", () => {
    const state = baseState({
      occurrences: [occurrence({ status: "missed" })],
    });

    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(candidates[0]).toMatchObject({
      type: DAY_ANALYSIS_ACTION_TYPE.RECOVER_BLOCK,
      deterministicAction: {
        context: "missed",
        occurrenceId: "occ_launch",
      },
    });
  });

  it("returns recovery candidates for blocked and reported session history", () => {
    const blockedState = baseState({
      occurrences: [occurrence()],
      sessionHistory: [
        {
          id: "history_blocked",
          occurrenceId: "occ_launch",
          dateKey: DAY,
          state: "ended",
          endedReason: "blocked",
          endedAt: "2026-04-19T09:40:00.000Z",
        },
      ],
    });
    const reportedState = baseState({
      occurrences: [occurrence()],
      sessionHistory: [
        {
          id: "history_reported",
          occurrenceId: "occ_launch",
          dateKey: DAY,
          state: "ended",
          endedReason: "reported",
          endedAt: "2026-04-19T09:45:00.000Z",
        },
      ],
    });

    expect(
      buildDayAnalysisCandidates({
        state: blockedState,
        todayData: todayData(),
        now: NOW,
        selectedDateKey: DAY,
      })[0].deterministicAction.context,
    ).toBe("blocked");
    expect(
      buildDayAnalysisCandidates({
        state: reportedState,
        todayData: todayData(),
        now: NOW,
        selectedDateKey: DAY,
      })[0].deterministicAction.context,
    ).toBe("reported");
  });

  it("returns reduce and simplify candidates for a long upcoming block", () => {
    const state = baseState({
      occurrences: [occurrence({ start: "11:00", durationMinutes: 60 })],
    });

    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(candidates.map((candidate) => candidate.type)).toEqual(
      expect.arrayContaining([
        DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION,
        DAY_ANALYSIS_ACTION_TYPE.SIMPLIFY_NEXT_ACTION,
      ]),
    );
    expect(candidates.every((candidate) => candidate.targetId !== "missing")).toBe(true);
  });

  it("returns a review-only short-block candidate for an empty day", () => {
    const state = baseState({ occurrences: [] });

    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData({ primaryAction: null }),
      now: NOW,
      selectedDateKey: DAY,
      primaryGoal: { id: "obj_launch", title: "Publier l’app" },
    });

    expect(candidates[0]).toMatchObject({
      type: DAY_ANALYSIS_ACTION_TYPE.ADD_SHORT_BLOCK,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY,
      deterministicAction: {
        reviewOnly: true,
        suggestedDurationMinutes: 15,
      },
    });
  });

  it("returns no-change guidance for a completed day", () => {
    const state = baseState({
      occurrences: [occurrence({ status: "done" })],
    });

    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    expect(candidates[0]).toMatchObject({
      type: DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE,
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE,
    });
  });
});

describe("day analysis contract", () => {
  it("validates a compact AI result that references deterministic candidates", () => {
    const state = baseState({
      occurrences: [occurrence({ start: "08:30", durationMinutes: 30 })],
    });
    const candidates = buildDayAnalysisCandidates({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });

    const result = validateDayAnalysisResult(
      {
        version: 1,
        dayKey: DAY,
        diagnosis: {
          title: "Un bloc est à récupérer",
          explanation: "Le bloc prévu ce matin n’a pas été lancé.",
          evidence: ["Bloc prévu à 08:30"],
          confidence: 0.82,
        },
        recommendedAction: {
          id: candidates[0].id,
          type: candidates[0].type,
          label: candidates[0].label,
          description: candidates[0].description,
          targetType: candidates[0].targetType,
          targetId: candidates[0].targetId,
          supportStatus: candidates[0].supportStatus,
          confirmationRequired: true,
          preview: candidates[0].preview,
        },
        alternatives: [],
        dataLimitations: [],
        userConfirmationRequired: true,
      },
      { candidates, dayKey: DAY },
    );

    expect(result.ok).toBe(true);
    expect(result.normalized.recommendedAction.deterministicAction).toMatchObject({
      kind: "recovery",
    });
  });

  it("rejects unsupported candidates, broad rewrites, mutation claims, and missing confirmation", () => {
    const result = validateDayAnalysisResult(
      {
        version: 1,
        dayKey: DAY,
        diagnosis: {
          title: "Tout le système doit être refondu",
          explanation: "J’ai déplacé ton bloc automatiquement.",
          confidence: 0.8,
        },
        recommendedAction: {
          id: "unknown_candidate",
          type: DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW,
          label: "Déplacer demain",
          targetType: "occurrence",
          targetId: "occ_launch",
          supportStatus: "applicable",
          confirmationRequired: false,
        },
        alternatives: [],
        dataLimitations: [],
        userConfirmationRequired: false,
      },
      { candidates: [], dayKey: DAY },
    );

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "recommended_action_unknown_candidate",
        "missing_user_confirmation_requirement",
        "broad_system_rewrite",
        "unsupported_mutation_claim",
      ]),
    );
  });
});

describe("day analysis cache", () => {
  it("returns stable hashes for equivalent snapshots and changes for meaningful day state", () => {
    const state = baseState({ occurrences: [occurrence()] });
    const snapshot = buildDayAnalysisSnapshot({
      state,
      todayData: todayData(),
      now: NOW,
      selectedDateKey: DAY,
    });
    const sameSnapshotDifferentNow = {
      ...snapshot,
      nowIso: "2026-04-19T12:00:00.000Z",
    };
    const changedSnapshot = {
      ...snapshot,
      occurrences: [{ ...snapshot.occurrences[0], derivedStatus: "missed" }],
    };

    expect(buildDayAnalysisSnapshotHash(snapshot)).toBe(
      buildDayAnalysisSnapshotHash(sameSnapshotDifferentNow),
    );
    expect(buildDayAnalysisSnapshotHash(snapshot)).not.toBe(
      buildDayAnalysisSnapshotHash(changedSnapshot),
    );
    expect(buildDayAnalysisCacheKey({ userId: "user_1", snapshot })).toContain(
      `day-analysis:v1:user_1:${DAY}:`,
    );
  });
});

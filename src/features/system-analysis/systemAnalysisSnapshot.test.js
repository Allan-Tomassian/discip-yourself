import { describe, expect, it } from "vitest";
import {
  SYSTEM_ANALYSIS_MODE,
  buildSystemAnalysisBackendSnapshot,
  buildSystemAnalysisSnapshot,
  buildSystemAnalysisSnapshotHash,
  recommendSystemAnalysisMode,
} from "./systemAnalysisSnapshot";

const NOW = new Date("2026-05-20T12:00:00");
const PERIOD = { startDateKey: "2026-05-14", endDateKey: "2026-05-20" };

function baseState(overrides = {}) {
  return {
    categories: [
      { id: "cat-work", name: "Travail" },
      { id: "cat-health", name: "Santé" },
    ],
    goals: [
      { id: "out-work", type: "OUTCOME", categoryId: "cat-work", title: "Livrer le projet" },
      { id: "act-work", type: "PROCESS", categoryId: "cat-work", parentId: "out-work", title: "Deep work" },
      { id: "out-health", type: "OUTCOME", categoryId: "cat-health", title: "Retrouver l’énergie" },
      { id: "act-health", type: "PROCESS", categoryId: "cat-health", parentId: "out-health", title: "Sport" },
    ],
    occurrences: [],
    sessionHistory: [],
    ui: {
      firstRunV1: {
        status: "done",
        draftAnswers: { whyText: "Construire une discipline stable pour ma santé et mon travail." },
        commitV1: { status: "applied", appliedAt: "2026-05-10T10:00:00.000Z" },
      },
    },
    user_ai_profile: {
      goals: ["health", "productivity"],
      time_budget_daily_min: 60,
      intensity_preference: "balanced",
      preferred_time_blocks: ["morning"],
      structure_preference: "structured",
    },
    ...overrides,
  };
}

describe("buildSystemAnalysisSnapshot", () => {
  it("derives overload planning load and system signals from real blocks", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        occurrences: [
          { id: "occ-1", goalId: "act-work", date: "2026-05-20", start: "09:00", durationMinutes: 30, status: "planned" },
          { id: "occ-2", goalId: "act-work", date: "2026-05-20", start: "10:00", durationMinutes: 30, status: "planned" },
          { id: "occ-3", goalId: "act-health", date: "2026-05-20", start: "11:00", durationMinutes: 30, status: "planned" },
          { id: "occ-4", goalId: "act-health", date: "2026-05-20", start: "14:00", durationMinutes: 30, status: "planned" },
        ],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.planningLoadSignals.overloadedDays).toEqual(
      expect.arrayContaining([expect.objectContaining({ dateKey: "2026-05-20", plannedCount: 4 })])
    );
    expect(snapshot.systemSignals.map((signal) => signal.type)).toContain("overload");
  });

  it("captures weak time windows, neglected objectives, and repeated session friction", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        occurrences: [
          { id: "occ-block-1", goalId: "act-health", date: "2026-05-18", start: "08:00", status: "planned" },
          { id: "occ-block-2", goalId: "act-health", date: "2026-05-19", start: "08:30", status: "planned" },
          { id: "occ-report-1", goalId: "act-health", date: "2026-05-20", start: "09:00", status: "planned" },
          { id: "occ-report-2", goalId: "act-health", date: "2026-05-20", start: "09:30", status: "planned" },
        ],
        sessionHistory: [
          { id: "hist-block-1", occurrenceId: "occ-block-1", actionId: "act-health", dateKey: "2026-05-18", state: "ended", endedReason: "blocked" },
          { id: "hist-block-2", occurrenceId: "occ-block-2", actionId: "act-health", dateKey: "2026-05-19", state: "ended", endedReason: "blocked" },
          { id: "hist-report-1", occurrenceId: "occ-report-1", actionId: "act-health", dateKey: "2026-05-20", state: "ended", endedReason: "reported" },
          { id: "hist-report-2", occurrenceId: "occ-report-2", actionId: "act-health", dateKey: "2026-05-20", state: "ended", endedReason: "reported" },
        ],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.timePatterns.weakWindows.map((window) => window.id)).toContain("morning");
    expect(snapshot.objectiveSignals.neglectedObjectives.map((objective) => objective.objectiveId)).toContain("out-health");
    expect(snapshot.frictionPatterns.repeatedBlocked[0]).toMatchObject({ actionId: "act-health" });
    expect(snapshot.frictionPatterns.repeatedReported[0]).toMatchObject({ actionId: "act-health" });
  });

  it("flags too many actions and why/execution mismatch when structured objectives have no execution", () => {
    const extraActions = Array.from({ length: 10 }, (_, index) => ({
      id: `act-extra-${index}`,
      type: "PROCESS",
      categoryId: "cat-work",
      title: `Action ${index}`,
    }));
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        goals: [
          ...baseState().goals,
          ...extraActions,
        ],
        occurrences: [
          { id: "occ-miss-1", goalId: "act-health", date: "2026-05-18", start: "08:00", status: "missed" },
          { id: "occ-miss-2", goalId: "act-health", date: "2026-05-19", start: "08:00", status: "missed" },
        ],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.actionsSummary.tooManyActions).toBe(true);
    expect(snapshot.actionsSummary.riskFlags).toContain("too_many_actions");
    expect(snapshot.frictionPatterns.whyExecutionMismatch).toMatchObject({
      detected: true,
      reason: "structured_objective_without_execution",
    });
  });

  it("summarizes coach themes without including raw transcripts", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState(),
      coachConversations: [
        {
          mode: "plan",
          useCase: "general",
          messages: [
            {
              role: "user",
              text: "SECRET TRANSCRIPT RAW planning surcharge impossible",
            },
          ],
        },
      ],
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.coachThemes.planConversationCount).toBe(1);
    expect(snapshot.coachThemes.themes.map((theme) => theme.id)).toEqual(
      expect.arrayContaining(["planning", "overload"])
    );
    expect(JSON.stringify(snapshot)).not.toContain("SECRET TRANSCRIPT RAW");
  });

  it("builds a deterministic hash that excludes generatedAt", () => {
    const args = {
      state: baseState({
        occurrences: [{ id: "occ-1", goalId: "act-work", date: "2026-05-20", start: "09:00", status: "done" }],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
    };
    const first = buildSystemAnalysisSnapshot({ ...args, now: new Date("2026-05-20T08:00:00") });
    const second = buildSystemAnalysisSnapshot({ ...args, now: new Date("2026-05-20T18:00:00") });

    expect(first.generatedAt).not.toBe(second.generatedAt);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(buildSystemAnalysisSnapshotHash({ ...first, generatedAt: "different" })).toBe(first.snapshotHash);
  });

  it("adds planned-system fields while keeping backend-compatible v1 serialization available", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        ui: {
          firstRunV1: {
            status: "done",
            selectedPlanId: "recommended",
            draftAnswers: {
              whyText: "Construire une discipline stable.",
              primaryGoal: "Livrer le projet sans m’épuiser",
              currentCapacity: "reprise",
              preferredWindows: [{ id: "pref-1", daysOfWeek: [1, 2], startTime: "08:00", endTime: "10:00", label: "Matin" }],
              unavailableWindows: [{ id: "busy-1", daysOfWeek: [1], startTime: "18:00", endTime: "22:00", label: "Soir indisponible" }],
              priorityCategoryIds: ["productivity"],
            },
            generatedPlans: {
              source: "ai_assisted_starter",
              plans: [{
                id: "recommended",
                comparisonMetrics: { weeklyMinutes: 120, totalBlocks: 4, activeDays: 3, engagementLevel: "recommended" },
                rationale: { whyFit: "Orienté livraison.", capacityFit: "Charge légère.", constraintFit: "Évite le soir." },
              }],
            },
            commitV1: { status: "applied", appliedAt: "2026-05-10T10:00:00.000Z", selectedPlanId: "recommended" },
          },
        },
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.plannedSystem).toMatchObject({
      primaryObjective: "Livrer le projet sans m’épuiser",
      capacity: { value: "reprise", dailyMinutes: 60 },
      priorityCategoryIds: ["productivity"],
    });
    expect(snapshot.plannedSystem.preferredWindows[0]).toMatchObject({ label: "Matin", startTime: "08:00" });
    expect(snapshot.plannedSystem.unavailableWindows[0]).toMatchObject({ label: "Soir indisponible", startTime: "18:00" });
    expect(snapshot.plannedSystem.firstRunPlanSummary).toMatchObject({
      selectedPlanId: "recommended",
      selectedPlanSource: "ai_assisted_starter",
      weeklyMinutes: 120,
      rationale: { capacityFit: "Charge légère." },
    });

    const backendSnapshot = buildSystemAnalysisBackendSnapshot(snapshot);
    expect(backendSnapshot.snapshotHash).toBe(snapshot.snapshotHash);
    expect(backendSnapshot.plannedSystem).toBeUndefined();
    expect(backendSnapshot.behaviorSystem).toBeUndefined();
    expect(backendSnapshot.analysisModeRecommendation).toBeUndefined();
  });

  it("classifies initial, hybrid, and behavioral analysis modes", () => {
    const initial = buildSystemAnalysisSnapshot({
      state: baseState(),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });
    const thinInitial = buildSystemAnalysisSnapshot({
      state: baseState({
        occurrences: [
          { id: "occ-one", goalId: "act-work", date: "2026-05-20", start: "09:00", durationMinutes: 30, status: "done" },
        ],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });
    const hybrid = buildSystemAnalysisSnapshot({
      state: baseState({
        occurrences: Array.from({ length: 5 }, (_, index) => ({
          id: `occ-hybrid-${index}`,
          goalId: index % 2 ? "act-work" : "act-health",
          date: index < 2 ? "2026-05-18" : index < 4 ? "2026-05-19" : "2026-05-20",
          start: index % 2 ? "09:00" : "14:00",
          durationMinutes: 30,
          status: "done",
        })),
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });
    const behavioralOccurrences = Array.from({ length: 10 }, (_, index) => ({
      id: `occ-behavior-${index}`,
      goalId: index % 2 ? "act-work" : "act-health",
      date: index < 4 ? "2026-05-18" : index < 7 ? "2026-05-19" : "2026-05-20",
      start: index % 3 === 0 ? "08:00" : index % 3 === 1 ? "14:00" : "19:00",
      durationMinutes: 30,
      status: index < 5 ? "done" : "planned",
    }));
    const behavioral = buildSystemAnalysisSnapshot({
      state: baseState({ occurrences: behavioralOccurrences }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(initial.analysisModeRecommendation).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(thinInitial.analysisModeRecommendation).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(hybrid.analysisModeRecommendation).toBe(SYSTEM_ANALYSIS_MODE.HYBRID);
    expect(behavioral.analysisModeRecommendation).toBe(SYSTEM_ANALYSIS_MODE.BEHAVIORAL);
    expect(recommendSystemAnalysisMode({
      firstRunSummary: { commitStatus: "applied" },
      executionStats: { expectedCount: 0, outcomeCount: 0, activeDayCount: 0, completedCount: 0, frictionCount: 0 },
      sessionStats: { endedCount: 0, frictionCount: 0 },
    })).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
  });

  it("summarizes behavior counts and marks unavailable telemetry limitations", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        occurrences: [
          { id: "occ-done", goalId: "act-work", date: "2026-05-18", start: "08:00", durationMinutes: 30, status: "done" },
          { id: "occ-missed", goalId: "act-work", date: "2026-05-18", start: "09:00", durationMinutes: 30, status: "missed" },
          { id: "occ-blocked", goalId: "act-health", date: "2026-05-19", start: "10:00", durationMinutes: 30, status: "planned" },
          { id: "occ-reported", goalId: "act-health", date: "2026-05-19", start: "11:00", durationMinutes: 30, status: "planned" },
          { id: "occ-skipped", goalId: "act-health", date: "2026-05-20", start: "12:00", durationMinutes: 30, status: "skipped" },
          { id: "occ-canceled", goalId: "act-work", date: "2026-05-20", start: "13:00", durationMinutes: 30, status: "canceled" },
        ],
        sessionHistory: [
          { id: "hist-blocked", occurrenceId: "occ-blocked", actionId: "act-health", dateKey: "2026-05-19", state: "ended", endedReason: "blocked", timerSeconds: 300 },
          { id: "hist-reported", occurrenceId: "occ-reported", actionId: "act-health", dateKey: "2026-05-19", state: "ended", endedReason: "reported", timerSeconds: 300 },
        ],
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.behaviorSystem).toMatchObject({
      completedCount: 1,
      missedCount: 1,
      blockedCount: 1,
      reportedCount: 1,
      skippedCanceledCount: 2,
      sessionStarts: 2,
    });
    expect(snapshot.behaviorSystem.plannedVsCompletedMinutes).toMatchObject({
      plannedMinutes: 120,
      completedMinutes: 30,
    });
    expect(snapshot.dataLimitations.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "missing_planning_edit_telemetry",
      "missing_correction_ignore_telemetry",
      "missing_detailed_session_event_telemetry",
    ]));
  });

  it("detects planned-vs-behavior comparison signals without raw telemetry", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({
        ui: {
          firstRunV1: {
            status: "done",
            draftAnswers: {
              whyText: "Reprendre le contrôle de mes semaines.",
              primaryGoal: "Livrer le projet",
              currentCapacity: "reprise",
              preferredWindows: [{ id: "pref-unused", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin libre" }],
            },
            commitV1: { status: "applied", appliedAt: "2026-05-10T10:00:00.000Z" },
          },
        },
        occurrences: [
          { id: "occ-avoid-1", goalId: "act-health", date: "2026-05-18", start: "20:00", durationMinutes: 90, status: "missed", repairV1: { type: "move_tomorrow" } },
          { id: "occ-avoid-2", goalId: "act-health", date: "2026-05-19", start: "20:00", durationMinutes: 90, status: "missed", repairV1: { type: "reduce_duration" } },
          { id: "occ-overload-1", goalId: "act-work", date: "2026-05-20", start: "14:00", durationMinutes: 90, status: "planned" },
          { id: "occ-overload-2", goalId: "act-work", date: "2026-05-20", start: "16:00", durationMinutes: 90, status: "planned" },
        ],
        system_analysis_v1: {
          version: 1,
          latestAnalysisId: "analysis-old",
          analyses: [{
            id: "analysis-old",
            version: 1,
            source: "premium_system_analysis",
            status: "partially_applied",
            snapshotHash: "old_hash",
            period: { ...PERIOD, days: 7 },
            generatedAt: "2026-05-19T10:00:00.000Z",
            savedAt: "2026-05-19T10:00:00.000Z",
            result: { period: PERIOD },
            appliedCorrectionIds: ["occurrence:1"],
            changedOccurrenceIds: ["occ-avoid-1"],
          }],
        },
      }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.comparisonSignals.nextBlockMissing.detected).toBe(false);
    expect(snapshot.comparisonSignals.unusedAvailableWindows).toMatchObject({
      detected: true,
      count: 1,
    });
    expect(snapshot.comparisonSignals.objectiveWithoutExecutableBlocks.objectiveIds).toContain("out-health");
    expect(snapshot.comparisonSignals.loadVsCapacityMismatch).toMatchObject({
      detected: true,
      capacityDailyMinutes: 60,
    });
    expect(snapshot.comparisonSignals.actionAvoidance).toMatchObject({
      detected: true,
      actionCount: 1,
    });
    expect(snapshot.comparisonSignals.repairHistorySignal).toMatchObject({
      detected: true,
      repairedCount: 2,
    });
    expect(snapshot.comparisonSignals.analysisHistorySignal).toMatchObject({
      detected: true,
      recordCount: 1,
      appliedCorrectionCount: 1,
    });
    expect(snapshot.comparisonSignals.whyExecutionMismatch).toMatchObject({ detected: true });
    expect(snapshot.confidenceBySignal.actionAvoidance).toMatch(/high|medium|low/);
    expect(JSON.stringify(snapshot)).not.toContain("messages");
  });

  it("detects missing next block on an empty committed plan", () => {
    const snapshot = buildSystemAnalysisSnapshot({
      state: baseState({ occurrences: [] }),
      period: PERIOD,
      referenceDateKey: "2026-05-20",
      now: NOW,
    });

    expect(snapshot.plannedSystem.nextBlockCoverage).toMatchObject({
      hasUpcomingBlock: false,
      missingNextBlock: true,
      upcomingPlannedCount: 0,
    });
    expect(snapshot.comparisonSignals.nextBlockMissing.detected).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildSystemAnalysisSnapshot,
  buildSystemAnalysisSnapshotHash,
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
});

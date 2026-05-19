import { describe, expect, it } from "vitest";
import { ADJUST_ACTION_IDS, buildAdjustDiagnostic } from "./adjustDiagnostic";

const ACTIVE_DATE = "2026-05-19";

function baseState(overrides = {}) {
  return {
    categories: [
      { id: "cat_business", name: "Business" },
      { id: "cat_health", name: "Santé" },
    ],
    goals: [
      {
        id: "goal_focus",
        type: "PROCESS",
        title: "Finaliser le parcours First Access",
        categoryId: "cat_business",
        durationMinutes: 75,
      },
      {
        id: "goal_sport",
        type: "PROCESS",
        title: "Séance sport légère",
        categoryId: "cat_health",
        durationMinutes: 30,
      },
    ],
    occurrences: [],
    ...overrides,
  };
}

describe("buildAdjustDiagnostic", () => {
  it("returns an honest low-information state without fake stats", () => {
    const diagnostic = buildAdjustDiagnostic({}, ACTIVE_DATE);

    expect(diagnostic.summary).toMatchObject({
      completionScore: null,
      plannedCount: 0,
      doneCount: 0,
      missedCount: 0,
      remainingCount: 0,
      remainingMinutes: 0,
      state: "low_information",
      hasAnyData: false,
      hasPlannedData: false,
    });
    expect(diagnostic.frictionSignals).toEqual([]);
    expect(diagnostic.recommendation.actionId).toBe(ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE);
  });

  it("detects real missed blocks, overload, and unclear next block from existing occurrences", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          { id: "occ_done", goalId: "goal_focus", date: ACTIVE_DATE, start: "08:00", status: "done", durationMinutes: 45 },
          { id: "occ_missed", goalId: "goal_focus", date: ACTIVE_DATE, start: "10:00", status: "missed", durationMinutes: 60 },
          { id: "occ_load_1", goalId: "goal_focus", date: ACTIVE_DATE, start: "12:00", status: "missed", durationMinutes: 75 },
          { id: "occ_load_2", goalId: "goal_sport", date: ACTIVE_DATE, start: "18:00", status: "missed", durationMinutes: 30 },
        ],
      }),
      ACTIVE_DATE
    );

    expect(diagnostic.summary.plannedCount).toBe(4);
    expect(diagnostic.summary.doneCount).toBe(1);
    expect(diagnostic.summary.missedCount).toBe(3);
    expect(diagnostic.frictionSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(["missed_blocks", "no_next_block"])
    );
    expect(diagnostic.recommendation.actionId).toBe(ADJUST_ACTION_IDS.SIMPLIFY_DAY);
  });

  it("maps high remaining load to a safe existing correction action", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          { id: "occ_1", goalId: "goal_focus", date: ACTIVE_DATE, start: "13:00", status: "planned", durationMinutes: 75 },
          { id: "occ_2", goalId: "goal_sport", date: ACTIVE_DATE, start: "18:00", status: "planned", durationMinutes: 60 },
        ],
      }),
      ACTIVE_DATE
    );

    expect(diagnostic.summary.remainingMinutes).toBe(135);
    expect(diagnostic.frictionSignals.map((signal) => signal.id)).toContain("high_load");
    expect(diagnostic.recommendation.actionId).toBe(ADJUST_ACTION_IDS.SIMPLIFY_DAY);
    expect(diagnostic.quickActions.map((action) => action.id)).toEqual([
      ADJUST_ACTION_IDS.SIMPLIFY_DAY,
      ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE,
      ADJUST_ACTION_IDS.REDUCE_LOAD,
      ADJUST_ACTION_IDS.ASK_COACH,
    ]);
  });

  it("keeps the next executable block factual when the system is readable", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          { id: "occ_done", goalId: "goal_focus", date: ACTIVE_DATE, start: "09:00", status: "done", durationMinutes: 45 },
          { id: "occ_next", goalId: "goal_sport", date: ACTIVE_DATE, start: "18:00", status: "planned", durationMinutes: 30 },
        ],
      }),
      ACTIVE_DATE
    );

    expect(diagnostic.nextBlock).toMatchObject({
      id: "occ_next",
      title: "Séance sport légère",
      categoryName: "Santé",
    });
    expect(diagnostic.recommendation.actionId).toBe(ADJUST_ACTION_IDS.ASK_COACH);
  });
});

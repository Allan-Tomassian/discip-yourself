import { describe, expect, it } from "vitest";
import { deriveTodayProgressModel } from "./todayProgressModel";

describe("deriveTodayProgressModel", () => {
  it("keeps daily progress action-only even when an outcome is done", () => {
    const activeHabits = [{ id: "a1" }, { id: "a2" }];
    const doneHabitIds = new Set(["a1"]);
    const goals = [
      { id: "a1", type: "PROCESS", status: "active" },
      { id: "a2", type: "PROCESS", status: "active" },
      { id: "o1", type: "OUTCOME", status: "done", completedAt: "2026-03-10" },
    ];

    const result = deriveTodayProgressModel({
      activeHabits,
      doneHabitIds,
      goals,
      occurrences: [],
      microChecks: {},
      localTodayKey: "2026-03-13",
      safeData: { goals, occurrences: [], microChecks: {} },
    });

    expect(result.coreProgress).toEqual({ total: 2, done: 1, ratio: 0.5 });
    expect(result.habitsDoneCount).toBe(1);
    expect(result.disciplineSummary.outcomesTotal).toBe(1);
  });
});

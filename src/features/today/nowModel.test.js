import { describe, expect, it } from "vitest";
import { deriveTodayNowModel, resolveTodayFocusCategory } from "./nowModel";

describe("resolveTodayFocusCategory", () => {
  it("prefers a category with actions over one with only outcomes", () => {
    const categories = [
      { id: "c1", name: "Outcome only" },
      { id: "c2", name: "Action first" },
    ];
    const goals = [
      { id: "o1", categoryId: "c1", type: "OUTCOME" },
      { id: "a1", categoryId: "c2", type: "PROCESS" },
    ];

    const result = resolveTodayFocusCategory({ categories, goals, selectedCategoryId: null });

    expect(result?.id).toBe("c2");
  });
});

describe("deriveTodayNowModel", () => {
  it("keeps the active session for the selected day even if no outcome is selected", () => {
    const categories = [{ id: "c1", name: "Deep Work" }];
    const goals = [{ id: "a1", categoryId: "c1", type: "PROCESS", status: "active", title: "Write" }];

    const result = deriveTodayNowModel({
      categories,
      goals,
      selectedCategoryId: "c1",
      rawActiveSession: {
        dateKey: "2026-03-13",
        objectiveId: "legacy-outcome",
        habitIds: ["a1"],
        runtimePhase: "in_progress",
      },
      selectedDateKey: "2026-03-13",
      focusOverride: null,
      plannedOccurrencesForDay: [],
      now: new Date(2026, 2, 13, 9, 0),
    });

    expect(result.sessionForDay?.objectiveId).toBe("legacy-outcome");
    expect(result.sessionHabit?.id).toBe("a1");
  });

  it("exposes a pure execution contract without selectedGoal or linked habits", () => {
    const categories = [{ id: "c1", name: "Fitness", mainGoalId: "o1" }];
    const goals = [
      { id: "o1", categoryId: "c1", type: "OUTCOME", title: "Run a race" },
      { id: "a1", categoryId: "c1", type: "PROCESS", status: "active", title: "Run 20 min" },
    ];

    const result = deriveTodayNowModel({
      categories,
      goals,
      selectedCategoryId: "c1",
      rawActiveSession: null,
      selectedDateKey: "2026-03-13",
      focusOverride: null,
      plannedOccurrencesForDay: [],
      now: new Date(2026, 2, 13, 9, 0),
    });

    expect(result.activeHabits.map((goal) => goal.id)).toEqual(["a1"]);
    expect(result.ensureProcessIds).toEqual(["a1"]);
    expect(result.selectedCategoryId).toBe("c1");
    expect(result.canStart).toBe(false);
    expect(result.fallbackReason).toBe("no_planned_occurrence");
    expect("selectedGoal" in result).toBe(false);
    expect("linkedHabits" in result).toBe(false);
    expect("unlinkedHabits" in result).toBe(false);
    expect("processGoals" in result).toBe(false);
  });
});

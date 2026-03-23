import { describe, expect, it } from "vitest";
import { buildInitialAiFoundationState, isAiFoundationPlanningGoal } from "./aiFoundation";

describe("aiFoundation", () => {
  it("seeds categories, goals, schedule rules and today occurrences from the onboarding profile", () => {
    const state = buildInitialAiFoundationState(
      {},
      {
        goals: ["business", "health"],
        time_budget_daily_min: 60,
        intensity_preference: "balanced",
        preferred_time_blocks: ["morning"],
        structure_preference: "structured",
      },
      new Date("2026-03-23T08:30:00"),
    );

    expect(state.user_ai_profile.goals).toEqual(["business", "health"]);
    expect(state.categories.map((category) => category.name)).toEqual(expect.arrayContaining(["Business", "Santé"]));
    expect(state.ui.onboardingCompleted).toBe(true);
    expect(state.ui.selectedCategoryId).toBe(state.categories[0].id);

    const planningGoal = state.goals.find((goal) => isAiFoundationPlanningGoal(goal));
    const activeScheduleRules = state.scheduleRules.filter((rule) => rule.isActive !== false);
    expect(planningGoal).toBeTruthy();
    expect(activeScheduleRules.length).toBeGreaterThanOrEqual(3);
    expect(activeScheduleRules.some((rule) => rule.actionId === planningGoal.id)).toBe(true);
    expect(state.occurrences.filter((occurrence) => occurrence.date === "2026-03-23")).toHaveLength(3);
    expect(state.occurrences.some((occurrence) => occurrence.goalId === planningGoal.id)).toBe(true);
  });

  it("uses only window occurrences for light/simple plans", () => {
    const state = buildInitialAiFoundationState(
      {},
      {
        goals: ["learning"],
        time_budget_daily_min: 30,
        intensity_preference: "light",
        preferred_time_blocks: ["evening"],
        structure_preference: "simple",
      },
      new Date("2026-03-23T08:30:00"),
    );

    const todaysOccurrences = state.occurrences.filter((occurrence) => occurrence.date === "2026-03-23");
    expect(todaysOccurrences).toHaveLength(2);
    expect(todaysOccurrences.every((occurrence) => occurrence.timeType === "window")).toBe(true);
    expect(todaysOccurrences.every((occurrence) => occurrence.noTime === true)).toBe(true);
  });
});

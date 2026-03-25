import { describe, expect, it } from "vitest";
import { computeCategoryScopedRecommendation, resolveCrossCategoryContribution } from "./todayCategoryCoherence";

const TODAY = "2026-03-06";

describe("computeCategoryScopedRecommendation", () => {
  it("prefers a planned occurrence in the active category over an earlier off-category block", () => {
    const result = computeCategoryScopedRecommendation({
      activeDate: TODAY,
      systemToday: TODAY,
      activeCategoryId: "cat-finance",
      categories: [
        { id: "cat-finance", name: "Finance" },
        { id: "cat-work", name: "Work" },
      ],
      goals: [
        { id: "goal-finance", title: "Budget", type: "PROCESS", categoryId: "cat-finance", status: "active" },
        { id: "goal-work", title: "Call client", type: "PROCESS", categoryId: "cat-work", status: "active" },
      ],
      occurrences: [
        { id: "occ-work", goalId: "goal-work", date: TODAY, status: "planned", start: "08:00", durationMinutes: 30 },
        { id: "occ-finance", goalId: "goal-finance", date: TODAY, status: "planned", start: "15:00", durationMinutes: 20 },
      ],
      plannedActionsForActiveDate: [
        { id: "occ-work", goalId: "goal-work", date: TODAY, status: "planned", start: "08:00", durationMinutes: 30 },
        { id: "occ-finance", goalId: "goal-finance", date: TODAY, status: "planned", start: "15:00", durationMinutes: 20 },
      ],
    });

    expect(result.reasonLinkType).toBe("direct_category");
    expect(result.selectionScope).toBe("active_category");
    expect(result.recommendedOccurrenceId).toBe("occ-finance");
    expect(result.recommendedActionId).toBe("goal-finance");
  });

  it("prioritizes structure_missing before cross-category when the active category has no actionable process", () => {
    const result = computeCategoryScopedRecommendation({
      activeDate: TODAY,
      systemToday: TODAY,
      activeCategoryId: "cat-finance",
      categories: [
        { id: "cat-finance", name: "Finance", mainGoalId: "goal-finance" },
        { id: "cat-work", name: "Work" },
      ],
      goals: [
        { id: "goal-finance", title: "Augmenter les revenus", type: "OUTCOME", categoryId: "cat-finance", status: "active" },
        { id: "goal-work", title: "Travailler l'offre", type: "PROCESS", categoryId: "cat-work", status: "active", sessionMinutes: 30 },
      ],
      occurrences: [{ id: "occ-work", goalId: "goal-work", date: TODAY, status: "planned", start: "08:00", durationMinutes: 30 }],
      plannedActionsForActiveDate: [{ id: "occ-work", goalId: "goal-work", date: TODAY, status: "planned", start: "08:00", durationMinutes: 30 }],
    });

    expect(result.reasonLinkType).toBe("structure_missing");
    expect(result.selectionScope).toBe("structure_missing");
    expect(result.recommendedOccurrenceId).toBeNull();
    expect(result.recommendedCategoryLabel).toBe("Finance");
    expect(result.contributionTargetLabel).toBe("Augmenter les revenus");
  });

  it("falls back to structure_missing when no proof exists", () => {
    const result = computeCategoryScopedRecommendation({
      activeDate: TODAY,
      systemToday: TODAY,
      activeCategoryId: "cat-finance",
      categories: [
        { id: "cat-finance", name: "Finance", mainGoalId: "goal-finance" },
        { id: "cat-sport", name: "Sport" },
      ],
      goals: [
        { id: "goal-finance", title: "Augmenter les revenus", type: "OUTCOME", categoryId: "cat-finance", status: "active" },
        { id: "goal-sport", title: "Run 20 min", type: "PROCESS", categoryId: "cat-sport", status: "active", sessionMinutes: 20 },
      ],
      occurrences: [],
      plannedActionsForActiveDate: [],
    });

    expect(result.hasGapToday).toBe(true);
    expect(result.reasonLinkType).toBe("structure_missing");
    expect(result.selectionScope).toBe("structure_missing");
    expect(result.candidateActionSummaries).toEqual([]);
    expect(result.explanation).toMatch(/clarifier l'objectif/i);
  });
});

describe("resolveCrossCategoryContribution", () => {
  it("does not accept a candidate without deterministic evidence", () => {
    const categoriesById = new Map([
      ["cat-finance", { id: "cat-finance", name: "Finance", mainGoalId: "goal-finance" }],
      ["cat-sport", { id: "cat-sport", name: "Sport" }],
    ]);
    const goalsById = new Map([
      ["goal-finance", { id: "goal-finance", title: "Augmenter les revenus", type: "OUTCOME", categoryId: "cat-finance" }],
      ["goal-sport", { id: "goal-sport", title: "Run 20 min", type: "PROCESS", categoryId: "cat-sport" }],
    ]);

    const result = resolveCrossCategoryContribution({
      activeCategory: categoriesById.get("cat-finance"),
      candidateGoal: goalsById.get("goal-sport"),
      categoriesById,
      goalsById,
    });

    expect(result).toBeNull();
  });
});

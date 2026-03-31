import { describe, expect, it } from "vitest";
import { normalizeLibraryFocusTarget, resolveCoachCreatedViewTarget } from "./coachCreatedViewTarget";

describe("coach created view target", () => {
  it("keeps canonical library-focus targets unchanged", () => {
    expect(
      normalizeLibraryFocusTarget({
        type: "library-focus",
        categoryId: "cat_sport",
        section: "actions",
        outcomeId: "goal_1",
        actionIds: ["action_1"],
      })
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "actions",
      outcomeId: "goal_1",
      actionIds: ["action_1"],
    });
  });

  it("normalizes legacy library-category targets into library-focus", () => {
    expect(
      normalizeLibraryFocusTarget({
        type: "library-category",
        categoryId: "cat_sport",
        focusSection: "objectives",
        outcomeId: "goal_1",
        actionIds: [],
      })
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "objectives",
      outcomeId: "goal_1",
      actionIds: [],
    });
  });

  it("reroutes legacy edit-item targets to objectives when the created item is an outcome", () => {
    expect(
      resolveCoachCreatedViewTarget(
        { type: "edit-item", itemId: "goal_1", categoryId: "cat_sport" },
        [{ id: "goal_1", categoryId: "cat_sport", type: "OUTCOME", planType: "STATE" }]
      )
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "objectives",
      outcomeId: "goal_1",
      actionIds: [],
    });
  });

  it("reroutes legacy edit-item targets to actions when the created item is a process", () => {
    expect(
      resolveCoachCreatedViewTarget(
        { type: "edit-item", itemId: "action_1", categoryId: "cat_sport" },
        [{ id: "action_1", categoryId: "cat_sport", type: "PROCESS", planType: "ACTION" }]
      )
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "actions",
      outcomeId: null,
      actionIds: ["action_1"],
    });
  });
});

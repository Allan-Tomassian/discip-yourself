import { describe, expect, it } from "vitest";
import { buildCreationViewTarget } from "./createItemCommit";

describe("createItemCommit view target", () => {
  it("ouvre la bibliotheque sur la categorie et la section objectifs quand seul un objectif est cree", () => {
    expect(
      buildCreationViewTarget({
        createdCategoryId: "cat_sport",
        createdOutcomeId: "goal_1",
        createdActionIds: [],
      })
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "objectives",
      outcomeId: "goal_1",
      actionIds: [],
    });
  });

  it("ouvre la bibliotheque sur la categorie et la section actions quand une action est creee", () => {
    expect(
      buildCreationViewTarget({
        createdCategoryId: "cat_sport",
        createdOutcomeId: null,
        createdActionIds: ["action_1"],
      })
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "actions",
      outcomeId: null,
      actionIds: ["action_1"],
    });
  });

  it("garde la bibliotheque comme target canonique pour une structure avec objectif et actions", () => {
    expect(
      buildCreationViewTarget({
        createdCategoryId: "cat_sport",
        createdOutcomeId: "goal_1",
        createdActionIds: ["action_1", "action_2"],
      })
    ).toEqual({
      type: "library-focus",
      categoryId: "cat_sport",
      section: "actions",
      outcomeId: "goal_1",
      actionIds: ["action_1", "action_2"],
    });
  });
});

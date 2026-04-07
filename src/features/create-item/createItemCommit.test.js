import { describe, expect, it } from "vitest";
import {
  buildCreationViewTarget,
  commitPreparedCreatePlan,
  prepareCreateCommit,
} from "./createItemCommit";
import {
  buildMinDeadlineKey,
  ensureSuggestedCategory,
  normalizeReminderTimes,
  resolveSuggestedCategories,
} from "./createItemShared";

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

describe("createItem shared helpers", () => {
  it("calcule une deadline minimale au lendemain", () => {
    expect(buildMinDeadlineKey("2026-04-07")).toBe("2026-04-08");
    expect(buildMinDeadlineKey("")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalise les reminders sans doublons", () => {
    expect(normalizeReminderTimes(["09:00", "09:00", "25:00", " 10:30 "])).toEqual(["09:00", "10:30"]);
  });

  it("insere une categorie suggeree uniquement si elle manque", () => {
    const state = {
      categories: [{ id: "cat_existing", name: "Travail", color: "#111111" }],
    };
    const suggestion = { id: "cat_energy", name: "Énergie", color: "#00ff00" };

    expect(ensureSuggestedCategory(state, suggestion).categories).toHaveLength(2);
    expect(ensureSuggestedCategory(state, state.categories[0])).toBe(state);
  });

  it("filtre les suggestions deja presentes par id ou nom", () => {
    const suggestions = resolveSuggestedCategories([
      { id: "cat_health", name: "Santé" },
      { id: "cat_custom", name: "Travail" },
    ]);

    expect(suggestions.some((category) => category.id === "cat_health")).toBe(false);
    expect(suggestions.some((category) => String(category.name).trim().toLowerCase() === "travail")).toBe(false);
  });

  it("laisse un objectif sans date cible quand le flow manuel choisit ce preset", () => {
    const state = {
      categories: [{ id: "cat_work", name: "Travail", color: "#111111" }],
      goals: [],
    };

    const preparedCommit = prepareCreateCommit({
      state,
      kind: "outcome",
      outcomeDraft: {
        title: "Stabiliser le lancement",
        categoryId: "cat_work",
        startDate: "2026-04-07",
        deadline: "",
      },
    });

    expect(preparedCommit.ok).toBe(true);
    expect(preparedCommit.plan.pendingOutcome.deadline).toBe("");

    const commitResult = commitPreparedCreatePlan(state, preparedCommit.plan);
    const createdOutcome = commitResult.state.goals.find((goal) => goal.id === commitResult.createdOutcomeId);

    expect(createdOutcome?.deadline).toBe("");
  });
});

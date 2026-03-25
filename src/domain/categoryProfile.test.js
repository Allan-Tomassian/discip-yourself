import { describe, expect, it } from "vitest";
import {
  createEmptyCategoryProfilesState,
  getCategoryProfile,
  getCategoryProfileSummary,
  hasMeaningfulCategoryProfile,
  normalizeCategoryProfilesV1,
} from "./categoryProfile";

describe("categoryProfile domain", () => {
  it("normalizes a complete profile with trims, caps, and deduped lists", () => {
    const normalized = normalizeCategoryProfilesV1(
      {
        version: 1,
        byCategoryId: {
          "cat-health": {
            categoryId: " cat-health ",
            subject: `  ${"S".repeat(140)}  `,
            mainGoal: `  ${"M".repeat(180)}  `,
            currentPriority: `  ${"P".repeat(140)}  `,
            watchpoints: [" Sommeil ", "sommeil", "", "Énergie", "Stress", "Hydratation", "Nutrition"],
            constraints: [" Horaires irréguliers ", "horaires irreguliers", "Déplacements"],
            currentLevel: 7,
            notes: `  ${"N".repeat(520)}  `,
            updatedAt: " 2026-03-25T10:00:00.000Z ",
          },
        },
      },
      [{ id: "cat-health", name: "Santé" }]
    );

    expect(normalized.byCategoryId["cat-health"]).toMatchObject({
      categoryId: "cat-health",
      subject: "S".repeat(120),
      mainGoal: "M".repeat(160),
      currentPriority: "P".repeat(120),
      watchpoints: ["Sommeil", "Énergie", "Stress", "Hydratation", "Nutrition"],
      constraints: ["Horaires irréguliers", "Déplacements"],
      currentLevel: null,
      notes: "N".repeat(500),
      updatedAt: "2026-03-25T10:00:00.000Z",
    });
  });

  it("normalizes a partial profile without crashing", () => {
    const normalized = normalizeCategoryProfilesV1(
      {
        byCategoryId: {
          "cat-finance": {
            subject: "Mieux piloter mes dépenses",
          },
        },
      },
      [{ id: "cat-finance", name: "Finance" }]
    );

    expect(normalized.byCategoryId["cat-finance"]).toEqual({
      categoryId: "cat-finance",
      subject: "Mieux piloter mes dépenses",
      mainGoal: null,
      currentPriority: null,
      watchpoints: [],
      constraints: [],
      currentLevel: null,
      notes: null,
      updatedAt: null,
    });
  });

  it("prunes orphan profiles when categories are provided", () => {
    const normalized = normalizeCategoryProfilesV1(
      {
        byCategoryId: {
          "cat-health": { subject: "Santé" },
          orphan: { subject: "Doit disparaître" },
        },
      },
      [{ id: "cat-health", name: "Santé" }]
    );

    expect(normalized.byCategoryId).toEqual({
      "cat-health": {
        categoryId: "cat-health",
        subject: "Santé",
        mainGoal: null,
        currentPriority: null,
        watchpoints: [],
        constraints: [],
        currentLevel: null,
        notes: null,
        updatedAt: null,
      },
    });
  });

  it("returns safe defaults and summaries from userData", () => {
    const userData = {
      categories: [{ id: "cat-mental", name: "Mental" }],
      category_profiles_v1: {
        version: 1,
        byCategoryId: {
          "cat-mental": {
            categoryId: "cat-mental",
            mainGoal: "Retrouver du calme",
            currentPriority: "Ralentir le soir",
          },
        },
      },
    };

    expect(getCategoryProfile(userData, "cat-mental")).toMatchObject({
      categoryId: "cat-mental",
      mainGoal: "Retrouver du calme",
      currentPriority: "Ralentir le soir",
    });
    expect(getCategoryProfile(userData, "missing")).toEqual({
      categoryId: "missing",
      subject: null,
      mainGoal: null,
      currentPriority: null,
      watchpoints: [],
      constraints: [],
      currentLevel: null,
      notes: null,
      updatedAt: null,
    });
    expect(getCategoryProfileSummary(userData, "cat-mental")).toEqual({
      categoryId: "cat-mental",
      categoryLabel: "Mental",
      subject: null,
      mainGoal: "Retrouver du calme",
      currentPriority: "Ralentir le soir",
      watchpoints: [],
      constraints: [],
      currentLevel: null,
      hasProfile: true,
    });
  });

  it("detects when a profile is meaningful", () => {
    expect(hasMeaningfulCategoryProfile({ categoryId: "cat-1" })).toBe(false);
    expect(
      hasMeaningfulCategoryProfile({
        categoryId: "cat-1",
        currentLevel: 3,
      })
    ).toBe(true);
  });

  it("creates an empty compatible state", () => {
    expect(createEmptyCategoryProfilesState()).toEqual({
      version: 1,
      byCategoryId: {},
    });
  });
});

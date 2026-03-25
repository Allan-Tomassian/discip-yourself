import { describe, it, expect } from "vitest";
import { DEFAULT_CATEGORY_ID, ensureCategoryId, initialData, migrate } from "./state";
import { buildScheduleRuleSourceKey, buildScheduleRulesFromAction } from "./scheduleRules";

function buildBaseState() {
  const base = initialData();
  base.categories = [{ id: "cat_1", name: "Cat", color: "#000000", wallpaper: "", mainGoalId: null }];
  base.goals = [
    {
      id: "goal_1",
      categoryId: "cat_1",
      title: "Action",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: "2026-02-02",
    },
  ];
  return base;
}

describe("migrate scheduleRules", () => {
  it("is idempotent across repeated migrations", () => {
    const first = migrate(buildBaseState());
    const second = migrate(first);
    expect(first.scheduleRules.length).toBeGreaterThan(0);
    expect(second.scheduleRules.length).toBe(first.scheduleRules.length);
    expect(second.scheduleRules.map((r) => r.sourceKey)).toEqual(first.scheduleRules.map((r) => r.sourceKey));
  });

  it("does not duplicate rules when sourceKey already exists", () => {
    const base = buildBaseState();
    const [rule] = buildScheduleRulesFromAction(base.goals[0]);
    const sourceKey = buildScheduleRuleSourceKey(rule);
    base.scheduleRules = [
      {
        ...rule,
        id: "rule_1",
        sourceKey,
        createdAt: "2026-02-02T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ];
    base.schemaVersion = 0;
    const migrated = migrate(base);
    const keys = migrated.scheduleRules.map((r) => r.sourceKey);
    expect(keys.filter((k) => k === sourceKey).length).toBe(1);
  });

  it("keeps unique sourceKey per actionId after 3 migrations", () => {
    const first = migrate(buildBaseState());
    const second = migrate(first);
    const third = migrate(second);

    const seen = new Set();
    const duplicates = [];
    for (const rule of third.scheduleRules) {
      const actionId = typeof rule.actionId === "string" ? rule.actionId : "";
      const sourceKey = typeof rule.sourceKey === "string" ? rule.sourceKey : "";
      if (!actionId || !sourceKey) continue;
      const key = `${actionId}::${sourceKey}`;
      if (seen.has(key)) duplicates.push(key);
      else seen.add(key);
    }
    expect(duplicates.length).toBe(0);
  });
});

describe("ensureCategoryId", () => {
  it("falls back to DEFAULT_CATEGORY_ID when missing", () => {
    const ensured = ensureCategoryId({ id: "g1" });
    expect(ensured.categoryId).toBe(DEFAULT_CATEGORY_ID);
  });

  it("trims and preserves a provided categoryId", () => {
    const ensured = ensureCategoryId({ id: "g1", categoryId: "  cat_1 " });
    expect(ensured.categoryId).toBe("cat_1");
  });
});

describe("totemV1 defaults", () => {
  it("initialData seeds totemV1 defaults", () => {
    const state = initialData();
    expect(state.ui.totemV1).toBeTruthy();
    expect(state.ui.totemV1.equipped.bodyColor).toBe("#F59E0B");
    expect(state.ui.totemV1.owned.colors).toContain("eagle-amber");
    expect(state.ui.totemV1.animationEnabled).toBe(true);
  });

  it("migrate normalizes missing totemV1 fields", () => {
    const base = buildBaseState();
    base.ui.totemV1 = {
      equipped: { bodyColor: "", accessoryIds: ["cap", "", null] },
      owned: { colors: [], accessories: ["cape", "cape"] },
      animationEnabled: false,
    };
    const migrated = migrate(base);
    expect(migrated.ui.totemV1.equipped.bodyColor).toBe("#F59E0B");
    expect(migrated.ui.totemV1.owned.colors).toContain("eagle-amber");
    expect(migrated.ui.totemV1.owned.accessories).toEqual(["cape"]);
    expect(migrated.ui.totemV1.animationEnabled).toBe(false);
  });
});

describe("category_profiles_v1", () => {
  it("initialData seeds an empty compatible state", () => {
    const state = initialData();
    expect(state.category_profiles_v1).toEqual({
      version: 1,
      byCategoryId: {},
    });
  });

  it("migrate normalizes and prunes orphan category profiles", () => {
    const base = buildBaseState();
    base.category_profiles_v1 = {
      byCategoryId: {
        cat_1: {
          categoryId: " cat_1 ",
          subject: "  Reprendre le cap  ",
          watchpoints: [" Sommeil ", "sommeil"],
          currentLevel: 9,
        },
        orphan: {
          categoryId: "orphan",
          subject: "Ne doit pas rester",
        },
      },
    };

    const migrated = migrate(base);

    expect(migrated.category_profiles_v1).toEqual({
      version: 1,
      byCategoryId: {
        cat_1: {
          categoryId: "cat_1",
          subject: "Reprendre le cap",
          mainGoal: null,
          currentPriority: null,
          watchpoints: ["Sommeil"],
          constraints: [],
          currentLevel: null,
          notes: null,
          updatedAt: null,
        },
      },
    });
  });
});

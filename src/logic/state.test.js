import { describe, it, expect } from "vitest";
import { initialData, migrate } from "./state";
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
});

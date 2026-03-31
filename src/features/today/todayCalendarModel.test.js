import { describe, expect, it } from "vitest";
import { deriveTodayCalendarModel } from "./todayCalendarModel";

describe("deriveTodayCalendarModel", () => {
  it("derives addActionContext without selectedGoalId", () => {
    const goalsById = new Map([["a1", { id: "a1", categoryId: "c1", color: "#123456" }]]);
    const categoriesById = new Map([["c1", { id: "c1", color: "#abcdef" }]]);
    const plannedCalendarOccurrences = {
      list: [{ goalId: "a1", dateKey: "2026-03-13" }],
    };

    const result = deriveTodayCalendarModel({
      plannedCalendarOccurrences,
      occurrences: [],
      goalsById,
      categoriesById,
      goalIdSet: new Set(["a1"]),
      selectedDateKey: "2026-03-13",
      selectedCategoryId: "c1",
      fallbackAccent: "#999999",
      defaultActionId: "a1",
    });

    expect(result.addActionContext).toEqual({ categoryId: "c1", actionId: "a1" });
    expect(result.selectedDateAccent).toBe("#ABCDEF");
    expect(result.plannedByDate.get("2026-03-13")).toBe(1);
  });
});

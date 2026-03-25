import { describe, expect, it } from "vitest";
import { getCoachContextSnapshot } from "./coachContextAdapter";

describe("coachContextAdapter", () => {
  const data = {
    ui: {
      selectedDateKey: "2026-03-25",
      selectedCategoryId: "cat_today",
      librarySelectedCategoryId: "cat_library",
      selectedCategoryByView: {
        today: "cat_today",
        planning: "cat_planning",
        library: "cat_library",
        pilotage: "cat_pilotage",
      },
    },
  };

  it("uses the planning category when the coach is opened from planning", () => {
    expect(getCoachContextSnapshot({ data, surfaceTab: "planning" })).toMatchObject({
      selectedDateKey: "2026-03-25",
      activeCategoryId: "cat_planning",
      surfaceTab: "planning",
      categoryView: "planning",
    });
  });

  it("uses the library category for category detail surfaces", () => {
    expect(getCoachContextSnapshot({ data, surfaceTab: "category-detail" })).toMatchObject({
      activeCategoryId: "cat_library",
      categoryView: "library",
    });
  });

  it("falls back to the today category for the dedicated coach route", () => {
    expect(getCoachContextSnapshot({ data, surfaceTab: "coach-chat" })).toMatchObject({
      activeCategoryId: "cat_today",
      categoryView: "today",
    });
  });
});

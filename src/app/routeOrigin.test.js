import { describe, expect, it } from "vitest";
import {
  normalizeRouteOrigin,
  resolveActiveTopNavTab,
  resolveMainTabForSurface,
  resolveRouteOriginLibraryMode,
} from "./routeOrigin";

describe("route origin helpers", () => {
  it("maps non-main task surfaces back to their canonical main tabs", () => {
    expect(resolveMainTabForSurface("category-detail", "today")).toBe("library");
    expect(resolveMainTabForSurface("coach", "planning")).toBe("planning");
    expect(resolveMainTabForSurface("account", "library")).toBe("today");
  });

  it("derives the active top nav tab from the current task surface", () => {
    expect(resolveActiveTopNavTab({ currentTab: "create-item", taskMainTab: "planning" })).toBe("planning");
    expect(resolveActiveTopNavTab({ currentTab: "edit-item", editReturnTab: "library" })).toBe("library");
    expect(resolveActiveTopNavTab({ currentTab: "pilotage" })).toBe("pilotage");
  });

  it("normalizes library route origin details", () => {
    expect(
      normalizeRouteOrigin({
        mainTab: "library",
        sourceSurface: "category-detail",
        categoryId: "cat_1",
        libraryMode: resolveRouteOriginLibraryMode({
          mainTab: "library",
          sourceSurface: "category-detail",
          categoryId: "cat_1",
        }),
      })
    ).toEqual({
      mainTab: "library",
      sourceSurface: "category-detail",
      categoryId: "cat_1",
      dateKey: null,
      occurrenceId: null,
      libraryMode: "category-view",
      coachConversationId: null,
    });
  });
});

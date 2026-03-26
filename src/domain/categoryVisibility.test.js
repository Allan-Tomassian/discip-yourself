import { describe, expect, it } from "vitest";
import {
  CATEGORY_VIEW,
  getExecutionActiveCategoryId,
  getSelectedCategoryForView,
  getStoredLibraryActiveCategoryId,
  resolveLibraryEntryCategoryId,
  sanitizeVisibleCategoryUi,
  withExecutionActiveCategoryId,
  withLibraryActiveCategoryId,
} from "./categoryVisibility";

const categories = [
  { id: "cat_exec", name: "Execution" },
  { id: "cat_library", name: "Bibliotheque" },
  { id: "cat_other", name: "Autre" },
];

describe("categoryVisibility execution and library contexts", () => {
  it("writes the shared execution context across today, planning and pilotage", () => {
    const nextUi = withExecutionActiveCategoryId(
      {
        selectedCategoryByView: {
          today: "cat_old",
          planning: "cat_old",
          library: "cat_library",
          pilotage: "cat_old",
        },
        selectedCategoryId: "cat_old",
        librarySelectedCategoryId: "cat_library",
      },
      "cat_exec"
    );

    expect(nextUi.selectedCategoryId).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.today).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.planning).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.pilotage).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.library).toBe("cat_library");
    expect(nextUi.librarySelectedCategoryId).toBe("cat_library");
  });

  it("writes the library context without overwriting execution", () => {
    const nextUi = withLibraryActiveCategoryId(
      {
        selectedCategoryByView: {
          today: "cat_exec",
          planning: "cat_exec",
          library: "cat_old_library",
          pilotage: "cat_exec",
        },
        selectedCategoryId: "cat_exec",
        librarySelectedCategoryId: "cat_old_library",
      },
      "cat_library"
    );

    expect(nextUi.selectedCategoryId).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.today).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.planning).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.pilotage).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.library).toBe("cat_library");
    expect(nextUi.librarySelectedCategoryId).toBe("cat_library");
  });

  it("reads the shared execution context for today, planning and pilotage while library stays local", () => {
    const source = {
      ui: {
        selectedCategoryId: "cat_exec",
        librarySelectedCategoryId: "cat_library",
        selectedCategoryByView: {
          today: "cat_exec",
          planning: "cat_exec",
          library: "cat_library",
          pilotage: "cat_exec",
        },
      },
    };

    expect(getExecutionActiveCategoryId(source)).toBe("cat_exec");
    expect(getStoredLibraryActiveCategoryId(source)).toBe("cat_library");
    expect(getSelectedCategoryForView(source, CATEGORY_VIEW.TODAY)).toBe("cat_exec");
    expect(getSelectedCategoryForView(source, CATEGORY_VIEW.PLANNING)).toBe("cat_exec");
    expect(getSelectedCategoryForView(source, CATEGORY_VIEW.PILOTAGE)).toBe("cat_exec");
    expect(getSelectedCategoryForView(source, CATEGORY_VIEW.LIBRARY)).toBe("cat_library");
  });

  it("resolves library entry with local first, then execution, then first visible fallback", () => {
    expect(
      resolveLibraryEntryCategoryId({
        source: {
          ui: {
            selectedCategoryId: "cat_exec",
            librarySelectedCategoryId: "cat_library",
          },
        },
        categories,
      })
    ).toBe("cat_library");

    expect(
      resolveLibraryEntryCategoryId({
        source: {
          ui: {
            selectedCategoryId: "cat_exec",
            librarySelectedCategoryId: null,
          },
        },
        categories,
      })
    ).toBe("cat_exec");

    expect(
      resolveLibraryEntryCategoryId({
        source: { ui: {} },
        categories,
      })
    ).toBe("cat_exec");
  });

  it("sanitizes execution as one canonical id and keeps library independent", () => {
    const nextUi = sanitizeVisibleCategoryUi(
      {
        selectedCategoryId: "cat_exec",
        librarySelectedCategoryId: "cat_library",
        selectedCategoryByView: {
          today: "cat_today_stale",
          planning: "cat_plan_stale",
          library: "cat_library",
          pilotage: "cat_pilotage_stale",
        },
      },
      categories
    );

    expect(nextUi.selectedCategoryId).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.today).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.planning).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.pilotage).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.home).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.plan).toBe("cat_exec");
    expect(nextUi.selectedCategoryByView.library).toBe("cat_library");
    expect(nextUi.librarySelectedCategoryId).toBe("cat_library");
  });
});

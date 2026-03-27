import { useEffect, useMemo, useRef } from "react";
import { resolveGoalType } from "../domain/goalType";
import {
  CATEGORY_VIEW,
  getFirstVisibleCategoryId,
  getExecutionActiveCategoryId,
  getSelectedCategoryForView,
  getStoredLibraryActiveCategoryId,
  resolveLibraryEntryCategoryId,
  withExecutionActiveCategoryId,
  withLibraryActiveCategoryId,
} from "../domain/categoryVisibility";
import { isPrimaryCategory } from "../logic/priority";
import { todayLocalKey } from "../utils/datetime";

function getHomeSelectedCategoryId(data) {
  const safe = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safe.categories) ? safe.categories : [];
  const goals = Array.isArray(safe.goals) ? safe.goals : [];
  const homeSelectedId = getSelectedCategoryForView(safe, CATEGORY_VIEW.TODAY);
  if (homeSelectedId && categories.some((c) => c.id === homeSelectedId)) return homeSelectedId;
  const primary = categories.find((c) => isPrimaryCategory(c)) || null;
  if (primary) return primary.id;
  const withGoal = categories.find((c) =>
    goals.some((g) => g.categoryId === c.id && resolveGoalType(g) === "OUTCOME")
  );
  return withGoal?.id || categories[0]?.id || null;
}

export function useCategorySelectionSync({
  tab,
  safeData,
  categories,
  setData,
  setTab,
  libraryCategoryId,
  setLibraryCategoryId,
  categoryDetailId,
  setCategoryDetailId,
  categoryProgressId,
  setCategoryProgressId,
  setSessionCategoryId,
}) {
  const prevTabRef = useRef(tab);
  const didInitTodaySyncRef = useRef(false);

  const librarySelectedCategoryId = getStoredLibraryActiveCategoryId(safeData);
  const homeActiveCategoryId = getExecutionActiveCategoryId(safeData);
  const selectedCategoryId = getExecutionActiveCategoryId(safeData);
  const homeSelectedCategoryId = getHomeSelectedCategoryId(safeData);
  const libraryEntryCategoryId = resolveLibraryEntryCategoryId({ source: safeData, categories });

  const openLibraryDetail = () => {
    const targetId = libraryEntryCategoryId || homeSelectedCategoryId;
    if (!targetId) {
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (!librarySelectedCategoryId || librarySelectedCategoryId !== targetId) {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const nextUi = withLibraryActiveCategoryId(prevUi, targetId);
        return {
          ...prev,
          ui: {
            ...nextUi,
            libraryDetailExpandedId: null,
          },
        };
      });
    }
    if (librarySelectedCategoryId === targetId) {
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (!prevUi.libraryDetailExpandedId) return prev;
        return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
      });
    }
    setLibraryCategoryId(null);
    setCategoryDetailId(null);
    setTab("library");
  };

  useEffect(() => {
    if (tab !== "library") return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryDetailExpandedId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
    });
  }, [tab, setData]);

  useEffect(() => {
    const prevTab = prevTabRef.current;
    const isEnteringToday = prevTab !== "today" && tab === "today";
    const isColdStartToday = tab === "today" && !didInitTodaySyncRef.current;
    if (isEnteringToday || isColdStartToday) {
      const today = todayLocalKey();
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (prevUi.selectedDate === today && prevUi.selectedDateKey === today) return prev;
        return {
          ...prev,
          ui: {
            ...prevUi,
            selectedDate: today,
            selectedDateKey: today,
          },
        };
      });
      didInitTodaySyncRef.current = true;
    } else if (tab === "today") {
      didInitTodaySyncRef.current = true;
    }
    if (prevTab !== "library" && tab === "library" && !librarySelectedCategoryId && libraryEntryCategoryId) {
      setData((prev) => {
        const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
        if (!prevCategories.some((category) => category.id === libraryEntryCategoryId)) return prev;
        const prevUi = prev.ui || {};
        const nextUi = withLibraryActiveCategoryId(prevUi, libraryEntryCategoryId);
        if (getStoredLibraryActiveCategoryId(prevUi) === libraryEntryCategoryId) return prev;
        return {
          ...prev,
          ui: nextUi,
        };
      });
    }
    prevTabRef.current = tab;
  }, [
    tab,
    categories,
    libraryEntryCategoryId,
    librarySelectedCategoryId,
    setData,
  ]);

  const handleSelectCategory = (categoryId) => {
    if (!categoryId) return;
    const syncExecutionCategorySelection = () => {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const nextUi = withExecutionActiveCategoryId(prevUi, categoryId);
        if (
          prevUi.selectedCategoryId === nextUi.selectedCategoryId &&
          JSON.stringify(prevUi.selectedCategoryByView || {}) === JSON.stringify(nextUi.selectedCategoryByView || {})
        ) return prev;
        return {
          ...prev,
          ui: nextUi,
        };
      });
    };
    const syncLibraryCategorySelection = (options = {}) => {
      const nextExpandedId = Object.prototype.hasOwnProperty.call(options, "libraryDetailExpandedId")
        ? options.libraryDetailExpandedId
        : undefined;
      setData((prev) => {
        const prevUi = prev.ui || {};
        const nextUi = withLibraryActiveCategoryId(prevUi, categoryId);
        const nextDetailExpandedId =
          nextExpandedId === undefined ? prevUi.libraryDetailExpandedId : nextExpandedId;
        if (
          getStoredLibraryActiveCategoryId(prevUi) === getStoredLibraryActiveCategoryId(nextUi) &&
          prevUi.libraryDetailExpandedId === nextDetailExpandedId &&
          JSON.stringify(prevUi.selectedCategoryByView || {}) === JSON.stringify(nextUi.selectedCategoryByView || {})
        ) return prev;
        return {
          ...prev,
          ui:
            nextDetailExpandedId === prevUi.libraryDetailExpandedId
              ? nextUi
              : { ...nextUi, libraryDetailExpandedId: nextDetailExpandedId },
        };
      });
    };
    if (tab === "today") {
      syncExecutionCategorySelection();
      setCategoryDetailId(categoryId);
      return;
    }
    if (tab === "planning") {
      syncExecutionCategorySelection();
      return;
    }
    if (tab === "library") {
      if (libraryCategoryId) {
        syncLibraryCategorySelection();
        setLibraryCategoryId(categoryId);
        return;
      }
      syncLibraryCategorySelection({
        libraryDetailExpandedId:
          libraryEntryCategoryId === categoryId && safeData?.ui?.libraryDetailExpandedId === categoryId ? null : categoryId,
      });
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (tab === "category-detail") {
      syncLibraryCategorySelection();
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (tab === "category-progress") {
      syncLibraryCategorySelection();
      setLibraryCategoryId(null);
      setCategoryProgressId(categoryId);
      setTab("category-progress", { categoryProgressId: categoryId });
      return;
    }
    if (tab === "edit-item") {
      syncLibraryCategorySelection();
      return;
    }
    if (tab === "pilotage") {
      syncExecutionCategorySelection();
      return;
    }
    if (tab === "session") {
      setSessionCategoryId(categoryId);
    }
  };

  const railSelectedId = useMemo(
    () =>
      tab === "category-detail"
        ? categoryDetailId
        : tab === "category-progress"
          ? categoryProgressId
          : tab === "pilotage"
            ? getExecutionActiveCategoryId(safeData) || homeSelectedCategoryId || null
          : tab === "planning"
            ? getExecutionActiveCategoryId(safeData) || homeSelectedCategoryId || null
            : tab === "library" || tab === "edit-item"
              ? libraryEntryCategoryId || null
              : getExecutionActiveCategoryId(safeData) || homeSelectedCategoryId || null,
    [
      tab,
      categoryDetailId,
      categoryProgressId,
      safeData,
      libraryEntryCategoryId,
      homeSelectedCategoryId,
    ]
  );

  const detailCategoryId =
    categoryDetailId ||
    resolveLibraryEntryCategoryId({ source: safeData, categories: safeData?.categories }) ||
    getFirstVisibleCategoryId(safeData?.categories) ||
    null;

  return {
    librarySelectedCategoryId,
    homeActiveCategoryId,
    selectedCategoryId,
    homeSelectedCategoryId,
    openLibraryDetail,
    handleSelectCategory,
    railSelectedId,
    detailCategoryId,
  };
}

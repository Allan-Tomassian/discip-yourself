import { useEffect, useMemo, useRef } from "react";
import { resolveGoalType } from "../domain/goalType";
import {
  CATEGORY_VIEW,
  getFirstVisibleCategoryId,
  getSelectedCategoryForView,
  withSelectedCategoryByView,
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
  isCreateTab,
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

  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const homeActiveCategoryId = getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY);
  const selectedCategoryId = safeData?.ui?.selectedCategoryId || null;
  const homeSelectedCategoryId = getHomeSelectedCategoryId(safeData);

  const openLibraryDetail = () => {
    let touched = false;
    try {
      touched = sessionStorage.getItem("library:selectedCategoryTouched") === "1";
    } catch (err) {
      void err;
      touched = false;
    }
    const libraryViewSelectedId = touched
      ? getSelectedCategoryForView(safeData, CATEGORY_VIEW.LIBRARY) || librarySelectedCategoryId || null
      : null;
    const hasLibrarySelection =
      libraryViewSelectedId && categories.some((c) => c.id === libraryViewSelectedId);
    const targetId = hasLibrarySelection ? libraryViewSelectedId : homeSelectedCategoryId;
    if (!targetId) {
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (!hasLibrarySelection) {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const nextUi = withSelectedCategoryByView(prevUi, {
          library: targetId,
          librarySelectedCategoryId: targetId,
        });
        return {
          ...prev,
          ui: {
            ...nextUi,
            libraryDetailExpandedId: null,
          },
        };
      });
    }
    if (hasLibrarySelection) {
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
    if (prevTab !== "library" && tab === "library") {
      let touched = false;
      try {
        touched = sessionStorage.getItem("library:selectedCategoryTouched") === "1";
      } catch (err) {
        void err;
        touched = false;
      }
      if (!touched) {
        const libraryId =
          getSelectedCategoryForView(safeData, CATEGORY_VIEW.LIBRARY) || safeData?.ui?.librarySelectedCategoryId || null;
        const hasHome =
          homeActiveCategoryId && categories.some((category) => category.id === homeActiveCategoryId);
        if (hasHome && homeActiveCategoryId !== libraryId) {
          setData((prev) => {
            const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
            if (!prevCategories.some((category) => category.id === homeActiveCategoryId)) return prev;
            const prevUi = prev.ui || {};
            const nextUi = withSelectedCategoryByView(prevUi, {
              library: homeActiveCategoryId,
              librarySelectedCategoryId: homeActiveCategoryId,
            });
            if (
              prevUi.librarySelectedCategoryId === homeActiveCategoryId &&
              getSelectedCategoryForView(prevUi, CATEGORY_VIEW.LIBRARY) === homeActiveCategoryId
            ) {
              return prev;
            }
            return {
              ...prev,
              ui: nextUi,
            };
          });
        }
      }
    }
    prevTabRef.current = tab;
  }, [
    tab,
    categories,
    homeActiveCategoryId,
    safeData?.ui?.selectedCategoryByView?.library,
    safeData?.ui?.librarySelectedCategoryId,
    setData,
  ]);

  const handleSelectCategory = (categoryId) => {
    if (!categoryId) return;
    const markLibraryTouched = () => {
      try {
        sessionStorage.setItem("library:selectedCategoryTouched", "1");
      } catch (err) {
        void err;
      }
    };
    const syncCategorySelection = ({ updateLegacy } = {}) => {
      const shouldUpdateLegacy = Boolean(updateLegacy);
      setData((prev) => {
        const prevUi = prev.ui || {};
        const nextUi = withSelectedCategoryByView(prevUi, {
          today: tab === "today" ? categoryId : getSelectedCategoryForView(prevUi, CATEGORY_VIEW.TODAY),
          planning: tab === "planning" ? categoryId : getSelectedCategoryForView(prevUi, CATEGORY_VIEW.PLANNING),
          library:
            tab === "library" || tab === "category-detail" || tab === "category-progress" || tab === "edit-item"
              ? categoryId
              : getSelectedCategoryForView(prevUi, CATEGORY_VIEW.LIBRARY),
          pilotage: tab === "pilotage" ? categoryId : getSelectedCategoryForView(prevUi, CATEGORY_VIEW.PILOTAGE),
          ...(shouldUpdateLegacy ? { selectedCategoryId: categoryId } : {}),
          ...(tab === "library" || tab === "category-detail" || tab === "category-progress" || tab === "edit-item"
            ? { librarySelectedCategoryId: categoryId }
            : {}),
        });
        if (
          prevUi.librarySelectedCategoryId === nextUi.librarySelectedCategoryId &&
          JSON.stringify(prevUi.selectedCategoryByView || {}) === JSON.stringify(nextUi.selectedCategoryByView || {}) &&
          (!shouldUpdateLegacy || prevUi.selectedCategoryId === categoryId)
        ) {
          return prev;
        }
        return {
          ...prev,
          ui: nextUi,
        };
      });
    };
    if (tab === "today") {
      syncCategorySelection({ updateLegacy: true });
      setCategoryDetailId(categoryId);
      return;
    }
    if (tab === "planning") {
      syncCategorySelection({ updateLegacy: true });
      return;
    }
    if (tab === "library") {
      markLibraryTouched();
      syncCategorySelection();
      if (libraryCategoryId) {
        setLibraryCategoryId(categoryId);
        return;
      }
      setData((prev) => {
        const prevUi = prev.ui || {};
        const isExpanded = prevUi.libraryDetailExpandedId === categoryId;
        return {
          ...prev,
          ui: {
            ...withSelectedCategoryByView(prevUi, {
              library: categoryId,
              librarySelectedCategoryId: categoryId,
            }),
            libraryDetailExpandedId: isExpanded ? null : categoryId,
          },
        };
      });
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (tab === "category-detail") {
      markLibraryTouched();
      syncCategorySelection();
      setLibraryCategoryId(null);
      setCategoryDetailId(null);
      setTab("library");
      return;
    }
    if (tab === "category-progress") {
      markLibraryTouched();
      syncCategorySelection();
      setLibraryCategoryId(null);
      setCategoryProgressId(categoryId);
      setTab("category-progress", { categoryProgressId: categoryId });
      return;
    }
    if (tab === "edit-item") {
      markLibraryTouched();
      syncCategorySelection();
      return;
    }
    if (tab === "pilotage") {
      setData((prev) => ({
        ...prev,
        ui: withSelectedCategoryByView(prev.ui, {
          pilotage: categoryId,
          selectedCategoryId: categoryId,
        }),
      }));
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
            ? safeData?.ui?.selectedCategoryByView?.pilotage ||
              getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY) ||
              safeData?.ui?.selectedCategoryId ||
              null
          : tab === "planning"
            ? getSelectedCategoryForView(safeData, CATEGORY_VIEW.PLANNING) ||
              getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY) ||
              safeData?.ui?.selectedCategoryId ||
              null
            : tab === "library" || tab === "edit-item" || isCreateTab
              ? getSelectedCategoryForView(safeData, CATEGORY_VIEW.LIBRARY) ||
                librarySelectedCategoryId ||
                getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY) ||
                safeData?.ui?.selectedCategoryId ||
                null
              : getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY) || safeData?.ui?.selectedCategoryId || null,
    [
      tab,
      categoryDetailId,
      categoryProgressId,
      safeData?.ui?.selectedCategoryByView?.pilotage,
      safeData?.ui?.selectedCategoryByView?.planning,
      safeData?.ui?.selectedCategoryByView?.home,
      safeData?.ui?.selectedCategoryByView?.library,
      safeData?.ui?.selectedCategoryId,
      isCreateTab,
      librarySelectedCategoryId,
    ]
  );

  const detailCategoryId =
    categoryDetailId ||
    getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY) ||
    safeData?.ui?.selectedCategoryId ||
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

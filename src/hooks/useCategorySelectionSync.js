import { useEffect, useMemo, useRef } from "react";
import { resolveGoalType } from "../domain/goalType";
import { isPrimaryCategory } from "../logic/priority";
import { todayLocalKey } from "../utils/datetime";

function getHomeSelectedCategoryId(data) {
  const safe = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safe.categories) ? safe.categories : [];
  const goals = Array.isArray(safe.goals) ? safe.goals : [];
  const homeSelectedId = safe.ui?.selectedCategoryByView?.home || safe.ui?.selectedCategoryId || null;
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

  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const homeActiveCategoryId =
    safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
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
      ? safeData?.ui?.selectedCategoryByView?.library || librarySelectedCategoryId || null
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
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: targetId,
            selectedCategoryByView: { ...prevSel, library: targetId },
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
    if (prevTab !== "today" && tab === "today") {
      const today = todayLocalKey();
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (prevUi.selectedDate === today) return prev;
        return { ...prev, ui: { ...prevUi, selectedDate: today } };
      });
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
          safeData?.ui?.selectedCategoryByView?.library || safeData?.ui?.librarySelectedCategoryId || null;
        const hasHome =
          homeActiveCategoryId && categories.some((category) => category.id === homeActiveCategoryId);
        if (hasHome && homeActiveCategoryId !== libraryId) {
          setData((prev) => {
            const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
            if (!prevCategories.some((category) => category.id === homeActiveCategoryId)) return prev;
            const prevUi = prev.ui || {};
            const prevSel =
              prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
                ? prevUi.selectedCategoryByView
                : {};
            if (prevUi.librarySelectedCategoryId === homeActiveCategoryId && prevSel.library === homeActiveCategoryId) {
              return prev;
            }
            return {
              ...prev,
              ui: {
                ...prevUi,
                librarySelectedCategoryId: homeActiveCategoryId,
                selectedCategoryByView: { ...prevSel, library: homeActiveCategoryId },
              },
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
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        if (
          prevUi.librarySelectedCategoryId === categoryId &&
          prevSel.library === categoryId &&
          prevSel.home === categoryId &&
          (!shouldUpdateLegacy || prevUi.selectedCategoryId === categoryId)
        ) {
          return prev;
        }
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId, home: categoryId },
            ...(shouldUpdateLegacy ? { selectedCategoryId: categoryId } : {}),
          },
        };
      });
    };
    if (tab === "today") {
      syncCategorySelection({ updateLegacy: true });
      setCategoryDetailId(categoryId);
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
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        const isExpanded = prevUi.libraryDetailExpandedId === categoryId;
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId },
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
        ui: {
          ...(prev.ui || {}),
          selectedCategoryByView: { ...(prev.ui?.selectedCategoryByView || {}), pilotage: categoryId },
        },
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
              safeData?.ui?.selectedCategoryByView?.home ||
              safeData?.ui?.selectedCategoryId ||
              null
            : tab === "library" || tab === "edit-item" || isCreateTab
              ? safeData?.ui?.selectedCategoryByView?.library ||
                librarySelectedCategoryId ||
                safeData?.ui?.selectedCategoryByView?.home ||
                safeData?.ui?.selectedCategoryId ||
                null
              : safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null,
    [
      tab,
      categoryDetailId,
      categoryProgressId,
      safeData?.ui?.selectedCategoryByView?.pilotage,
      safeData?.ui?.selectedCategoryByView?.home,
      safeData?.ui?.selectedCategoryByView?.library,
      safeData?.ui?.selectedCategoryId,
      isCreateTab,
      librarySelectedCategoryId,
    ]
  );

  const detailCategoryId =
    categoryDetailId ||
    safeData?.ui?.selectedCategoryByView?.home ||
    safeData?.ui?.selectedCategoryId ||
    safeData?.categories?.[0]?.id ||
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

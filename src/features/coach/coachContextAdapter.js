import { CATEGORY_VIEW, getSelectedCategoryForView } from "../../domain/categoryVisibility";
import { normalizeLocalDateKey, todayLocalKey } from "../../utils/dateKey";

function resolveCoachCategoryView(surfaceTab) {
  if (surfaceTab === "planning" || surfaceTab === "timeline") return CATEGORY_VIEW.PLANNING;
  if (surfaceTab === "pilotage" || surfaceTab === "insights") return CATEGORY_VIEW.PILOTAGE;
  if (
    surfaceTab === "library" ||
    surfaceTab === "objectives" ||
    surfaceTab === "category-detail" ||
    surfaceTab === "category-progress"
  ) {
    return CATEGORY_VIEW.LIBRARY;
  }
  return CATEGORY_VIEW.TODAY;
}

export function getCoachContextSnapshot({ data, surfaceTab } = {}) {
  const safeData = data && typeof data === "object" ? data : {};
  const safeUi = safeData.ui && typeof safeData.ui === "object" ? safeData.ui : {};
  const selectedDateKey =
    normalizeLocalDateKey(safeUi.selectedDateKey || safeUi.selectedDate) || todayLocalKey();
  const categoryView = resolveCoachCategoryView(surfaceTab);
  return {
    selectedDateKey,
    activeCategoryId: getSelectedCategoryForView(safeData, categoryView) || null,
    surfaceTab: surfaceTab || "today",
    categoryView,
  };
}

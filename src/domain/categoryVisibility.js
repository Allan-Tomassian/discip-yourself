import { SYSTEM_INBOX_ID } from "../logic/state";

export const CATEGORY_VIEW = Object.freeze({
  TODAY: "today",
  PLANNING: "planning",
  LIBRARY: "library",
  PILOTAGE: "pilotage",
});

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractUi(source) {
  if (source?.ui && typeof source.ui === "object") return source.ui;
  return asObject(source);
}

export function isSystemCategoryId(categoryId) {
  return asString(categoryId) === SYSTEM_INBOX_ID;
}

export function isVisibleCategory(category) {
  const id = asString(category?.id);
  return Boolean(id) && !isSystemCategoryId(id);
}

export function getVisibleCategories(categories) {
  return (Array.isArray(categories) ? categories : []).filter(isVisibleCategory);
}

export function getVisibleCategoryIds(categories) {
  return new Set(getVisibleCategories(categories).map((category) => category.id));
}

export function getFirstVisibleCategoryId(categories) {
  return getVisibleCategories(categories)[0]?.id || null;
}

export function normalizeSelectedCategoryByView(raw) {
  const source = asObject(raw);
  const today = asString(source.today) || asString(source.home) || null;
  const planning = asString(source.planning) || asString(source.plan) || null;
  const library = asString(source.library) || null;
  const pilotage = asString(source.pilotage) || null;
  return {
    today,
    planning,
    library,
    pilotage,
    home: today,
    plan: planning,
  };
}

export function getExecutionActiveCategoryId(source) {
  const ui = extractUi(source);
  const selectedByView = normalizeSelectedCategoryByView(ui.selectedCategoryByView);
  const legacySelected = asString(ui.selectedCategoryId) || null;
  return legacySelected || selectedByView.today || selectedByView.planning || selectedByView.pilotage || null;
}

export function getStoredLibraryActiveCategoryId(source) {
  const ui = extractUi(source);
  const selectedByView = normalizeSelectedCategoryByView(ui.selectedCategoryByView);
  return selectedByView.library || asString(ui.librarySelectedCategoryId) || null;
}

export function withExecutionActiveCategoryId(ui, categoryId) {
  const safeUi = asObject(ui);
  const nextCategoryId = asString(categoryId) || null;
  return withSelectedCategoryByView(safeUi, {
    today: nextCategoryId,
    planning: nextCategoryId,
    pilotage: nextCategoryId,
    selectedCategoryId: nextCategoryId,
  });
}

export function withLibraryActiveCategoryId(ui, categoryId) {
  const safeUi = asObject(ui);
  const nextCategoryId = asString(categoryId) || null;
  return withSelectedCategoryByView(safeUi, {
    library: nextCategoryId,
    librarySelectedCategoryId: nextCategoryId,
  });
}

export function resolveLibraryEntryCategoryId({ source, categories } = {}) {
  return resolvePreferredVisibleCategoryId({
    categories,
    candidates: [
      getStoredLibraryActiveCategoryId(source),
      getExecutionActiveCategoryId(source),
      getFirstVisibleCategoryId(categories),
    ],
  });
}

export function getSelectedCategoryForView(source, view) {
  const safeView = asString(view);
  if (safeView === CATEGORY_VIEW.LIBRARY) {
    return getStoredLibraryActiveCategoryId(source) || getExecutionActiveCategoryId(source);
  }
  if (safeView === CATEGORY_VIEW.PLANNING) {
    return getExecutionActiveCategoryId(source);
  }
  if (safeView === CATEGORY_VIEW.PILOTAGE) {
    return getExecutionActiveCategoryId(source);
  }
  return getExecutionActiveCategoryId(source);
}

export function resolveVisibleCategoryId(categoryId, categories) {
  const candidate = asString(categoryId);
  if (!candidate) return null;
  const visibleIds = getVisibleCategoryIds(categories);
  return visibleIds.has(candidate) ? candidate : null;
}

export function resolvePreferredVisibleCategoryId({ categories, candidates = [] } = {}) {
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const resolved = resolveVisibleCategoryId(candidate, categories);
    if (resolved) return resolved;
  }
  return getFirstVisibleCategoryId(categories);
}

export function withSelectedCategoryByView(ui, updates = {}) {
  const safeUi = asObject(ui);
  const nextSelectedByView = normalizeSelectedCategoryByView(safeUi.selectedCategoryByView);

  if ("today" in updates) nextSelectedByView.today = asString(updates.today) || null;
  if ("planning" in updates) nextSelectedByView.planning = asString(updates.planning) || null;
  if ("library" in updates) nextSelectedByView.library = asString(updates.library) || null;
  if ("pilotage" in updates) nextSelectedByView.pilotage = asString(updates.pilotage) || null;
  if ("home" in updates) nextSelectedByView.today = asString(updates.home) || null;
  if ("plan" in updates) nextSelectedByView.planning = asString(updates.plan) || null;

  nextSelectedByView.home = nextSelectedByView.today;
  nextSelectedByView.plan = nextSelectedByView.planning;

  let selectedCategoryId = asString(safeUi.selectedCategoryId) || null;
  if ("selectedCategoryId" in updates) {
    selectedCategoryId = asString(updates.selectedCategoryId) || null;
  } else if ("today" in updates || "home" in updates) {
    selectedCategoryId = nextSelectedByView.today;
  } else if ("planning" in updates || "plan" in updates) {
    selectedCategoryId = nextSelectedByView.planning;
  }

  const nextUi = {
    ...safeUi,
    selectedCategoryId,
    selectedCategoryByView: nextSelectedByView,
  };

  if ("librarySelectedCategoryId" in updates) {
    nextUi.librarySelectedCategoryId = asString(updates.librarySelectedCategoryId) || null;
  }

  return nextUi;
}

export function sanitizeVisibleCategoryUi(ui, categories) {
  const safeUi = withSelectedCategoryByView(ui);
  const selectedByView = normalizeSelectedCategoryByView(safeUi.selectedCategoryByView);
  const fallbackVisibleId = getFirstVisibleCategoryId(categories);
  const execution = resolvePreferredVisibleCategoryId({
    categories,
    candidates: [
      getExecutionActiveCategoryId(safeUi),
      selectedByView.today,
      selectedByView.planning,
      selectedByView.pilotage,
      safeUi.selectedCategoryId,
      fallbackVisibleId,
    ],
  });
  const library = resolveVisibleCategoryId(getStoredLibraryActiveCategoryId(safeUi), categories);
  const planning = resolveVisibleCategoryId(selectedByView.planning, categories);
  const pilotage = resolveVisibleCategoryId(selectedByView.pilotage, categories);

  return withSelectedCategoryByView(
    {
      ...safeUi,
      librarySelectedCategoryId: library,
    },
    {
      today: execution,
      planning,
      library,
      pilotage,
      selectedCategoryId: execution,
      librarySelectedCategoryId: library,
    }
  );
}

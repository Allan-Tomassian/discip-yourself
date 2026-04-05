const MAIN_TABS = new Set(["today", "objectives", "timeline", "insights", "coach"]);
const DRAWER_TABS = new Set([
  "settings",
  "account",
  "billing",
  "data",
  "privacy",
  "legal",
  "support",
  "faq",
  "journal",
  "micro-actions",
  "history",
]);

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const next = asString(value);
  return next || null;
}

function normalizeDate(value) {
  const next = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "";
}

export function normalizeMainTab(value, fallback = "today") {
  const raw = asString(value);
  const next =
    raw === "planning" || raw === "plan"
      ? "timeline"
      : raw === "library"
        ? "objectives"
        : raw === "pilotage" || raw === "tools"
          ? "insights"
          : raw;
  return MAIN_TABS.has(next) ? next : fallback;
}

export function resolveMainTabForSurface(surface, fallbackMainTab = "today") {
  const rawSurface = asString(surface);
  const safeSurface =
    rawSurface === "planning"
      ? "timeline"
      : rawSurface === "library"
        ? "objectives"
        : rawSurface === "pilotage" || rawSurface === "tools"
          ? "insights"
          : rawSurface;
  if (MAIN_TABS.has(safeSurface)) return safeSurface;
  if (safeSurface === "category-detail" || safeSurface === "category-progress" || safeSurface === "edit-item") {
    return "objectives";
  }
  if (safeSurface === "session" || safeSurface === "onboarding" || DRAWER_TABS.has(safeSurface)) {
    return "today";
  }
  if (safeSurface === "create-item") {
    return normalizeMainTab(fallbackMainTab, "today");
  }
  return normalizeMainTab(fallbackMainTab, "today");
}

export function resolveRouteOriginLibraryMode({ mainTab, sourceSurface, categoryId = null } = {}) {
  if (normalizeMainTab(mainTab, "") !== "objectives") return null;
  const safeSurface = asString(sourceSurface);
  if (safeSurface === "category-detail" || safeSurface === "category-progress" || safeSurface === "edit-item") {
    return "category-view";
  }
  if (safeSurface === "library" || safeSurface === "objectives") {
    return categoryId ? "category-view" : "root";
  }
  return "root";
}

export function normalizeRouteOrigin(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  return {
    mainTab: normalizeMainTab(source.mainTab, "today"),
    sourceSurface: asNullableString(source.sourceSurface) || "today",
    categoryId: asNullableString(source.categoryId),
    dateKey: normalizeDate(source.dateKey) || null,
    occurrenceId: asNullableString(source.occurrenceId),
    libraryMode:
      source.libraryMode === "category-view"
        ? "category-view"
        : source.libraryMode === "root"
          ? "root"
          : null,
    coachConversationId: asNullableString(source.coachConversationId),
  };
}

export function resolveActiveTopNavTab({
  currentTab,
  taskMainTab = null,
  editReturnTab = null,
} = {}) {
  const safeCurrentTab = asString(currentTab);
  if (safeCurrentTab === "session" || safeCurrentTab === "onboarding") return "today";
  if (safeCurrentTab === "create-item") return normalizeMainTab(taskMainTab, "objectives");
  if (safeCurrentTab === "edit-item") return resolveMainTabForSurface(editReturnTab, "objectives");
  if (safeCurrentTab === "category-detail" || safeCurrentTab === "category-progress") return "objectives";
  if (DRAWER_TABS.has(safeCurrentTab)) return "today";
  return resolveMainTabForSurface(safeCurrentTab, "today");
}

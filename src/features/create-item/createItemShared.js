import { normalizeCategory } from "../../logic/state";
import { normalizeLocalDateKey, normalizeStartTime, todayLocalKey, toLocalDateKey } from "../../utils/datetime";
import { SUGGESTED_CATEGORIES } from "../../utils/categoriesSuggested";

export function buildMinDeadlineKey(startDate) {
  const normalized = normalizeLocalDateKey(startDate) || todayLocalKey();
  const base = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(base.getTime())) return normalized;
  base.setDate(base.getDate() + 1);
  return toLocalDateKey(base);
}

export function normalizeReminderTimes(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  return list
    .map((entry) => normalizeStartTime(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

export function ensureSuggestedCategory(state, selectedSuggestion) {
  if (!selectedSuggestion) return state;
  const prevCategories = Array.isArray(state.categories) ? state.categories : [];
  if (prevCategories.some((category) => category?.id === selectedSuggestion.id)) return state;
  const created = normalizeCategory(
    { id: selectedSuggestion.id, name: selectedSuggestion.name, color: selectedSuggestion.color },
    prevCategories.length
  );
  return { ...state, categories: [...prevCategories, created] };
}

export function resolveSuggestedCategories(categories) {
  const visibleCategories = Array.isArray(categories) ? categories : [];
  const existingNames = new Set(
    visibleCategories.map((category) => String(category?.name || "").trim().toLowerCase()).filter(Boolean)
  );
  const existingIds = new Set(visibleCategories.map((category) => category?.id).filter(Boolean));
  return SUGGESTED_CATEGORIES.filter(
    (category) =>
      category &&
      !existingIds.has(category.id) &&
      !existingNames.has(String(category.name || "").trim().toLowerCase())
  );
}

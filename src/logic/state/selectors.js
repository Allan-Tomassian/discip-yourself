import { normalizeSelectedCategoryByView } from "../../domain/categoryVisibility";

export function selectProfile(state) {
  return state && typeof state === "object" && state.profile && typeof state.profile === "object"
    ? state.profile
    : {};
}

export function selectUi(state) {
  return state && typeof state === "object" && state.ui && typeof state.ui === "object" ? state.ui : {};
}

export function selectCategories(state) {
  return Array.isArray(state?.categories) ? state.categories : [];
}

export function selectGoals(state) {
  return Array.isArray(state?.goals) ? state.goals : [];
}

export function selectSelectedCategoryByView(state) {
  const ui = selectUi(state);
  return normalizeSelectedCategoryByView(ui.selectedCategoryByView);
}
